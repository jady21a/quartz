// 邮件通讯的定时群发 Worker。
//
// 每次触发做的事:拉 /newsletter.xml → 和 D1 里「见过的文章」对差 → 新文章逐个群发。
//
// 三道保险,对应自建 newsletter 最容易出的三种事故:
//
//   1. 首次接管的存货轰炸。库是空的时,feed 里那 20 篇存量文章全是「新」的。
//      所以第一次跑走 bootstrap 分支:全部记为已见,一封不发。
//   2. 重发。站点重新构建、guid 口径变了、定时任务重叠执行 —— 任何一个都可能
//      让老文章重新变成「新」的。sent 表的复合主键 + 先记账后发信兜住。
//   3. 失控群发。真出了 bug(比如 slug 全变了导致 20 篇全是新的),
//      MAX_NEW_ENTRIES 熔断会直接中止并发邮件告警,而不是老老实实发 20×N 封。
//
// 免费版 Workers 每次调用最多 50 个 subrequest(SES 每封信 1 个,D1 每次查询 1 个),
// 所以单轮发送量有上限;没发完的下一轮继续,状态全在 sent 表里,天然可续传。

import { parseFeed } from "../shared/feed.js"
import { sendMail } from "../shared/mailer.js"
import { renderIssue } from "../shared/render.js"
import { signToken } from "../shared/tokens.js"
import {
  countByStatus,
  countRecipientsFor,
  deleteSent,
  getSeenGuids,
  markBroadcastDone,
  markSeen,
  pendingBroadcasts,
  recipientsFor,
  recordSentBatch,
} from "../shared/db.js"

// 一轮最多发多少封。免费版 subrequest 上限 50,留出 feed 拉取和几次 D1 查询的余量。
// 升到 Workers Paid(1000 subrequest)后可以把 MAX_SENDS_PER_RUN 调到 800。
const DEFAULT_MAX_SENDS_PER_RUN = 35
// 一轮里出现超过这么多篇「新文章」就判定为异常,中止并告警
const DEFAULT_MAX_NEW_ENTRIES = 3
// 记账的批次大小:太大则崩溃时多漏几个人,太小则多花 subrequest
const CHUNK = 10

function siteBase(env) {
  return (env.SITE_URL || "https://jz21.eu.org").replace(/\/$/, "")
}

async function unsubscribeUrlFor(env, email) {
  const token = await signToken(env.NEWSLETTER_SECRET, email, "unsubscribe", 0)
  return `${siteBase(env)}/api/unsubscribe?token=${encodeURIComponent(token)}`
}

async function alertAdmin(env, subject, body) {
  console.error(`[newsletter] ${subject}: ${body}`)
  if (!env.ADMIN_EMAIL) return
  await sendMail(env, {
    to: env.ADMIN_EMAIL,
    subject: `[newsletter] ${subject}`,
    html: `<pre style="white-space:pre-wrap;font-family:monospace;">${body}</pre>`,
    text: body,
  }).catch(() => {})
}

/**
 * 把一篇文章发给还没收到的人,发到预算用完为止。
 * @returns {{sent:number, failed:number, done:boolean}} done=false 表示还有人没发到,下轮继续
 */
async function broadcastEntry(env, db, entry, budget, dryRun) {
  let sent = 0
  let failed = 0

  if (dryRun) {
    const total = await countRecipientsFor(db, entry.guid)
    const sample = await recipientsFor(db, entry.guid, 10)
    console.log(
      `[dry-run] 《${entry.title}》→ ${total} 人,例如:` +
        sample.map((r) => r.email).join(", ") +
        (total > sample.length ? " …" : ""),
    )
    return { sent: total, failed: 0, done: true }
  }

  // 本轮已经失败过的人。临时失败会回滚记账让他重回队列(deleteSent),
  // 如果不在本轮里把他排除掉,下一个 chunk 会立刻又把他捞出来重发 ——
  // 一个持续失败的地址能把整轮预算全烧在自己身上,后面的人一封都收不到。
  // 重试留给下一次定时触发,那时故障多半已经过去了。
  const failedThisRun = new Set()

  while (budget > 0) {
    const rows = await recipientsFor(db, entry.guid, Math.min(CHUNK, budget))
    if (!rows.length) return { sent, failed, done: true }

    const recipients = rows.filter((r) => !failedThisRun.has(r.id))
    // 捞上来的全是本轮失败过的:这一篇本轮到此为止,剩下的下轮再说
    if (!recipients.length) return { sent, failed, done: false }

    // 先记账再发信:宁可漏发也不要重发(见 db.js recordSentBatch 的注释)
    await recordSentBatch(
      db,
      recipients.map((r) => r.id),
      entry.guid,
    )

    for (const person of recipients) {
      const unsubscribeUrl = await unsubscribeUrlFor(env, person.email)
      const mail = renderIssue({ entry, unsubscribeUrl, lang: person.lang })
      const res = await sendMail(env, {
        to: person.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: {
          // Gmail / Yahoo 对批量发件人的硬性要求(RFC 8058),没有它直接影响进箱率
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          "List-Id": `Why Z <newsletter.${new URL(siteBase(env)).host}>`,
        },
      })

      budget--
      if (res.ok) {
        sent++
      } else {
        failed++
        failedThisRun.add(person.id)
        console.error(`[newsletter] 发送失败 ${person.email}: ${res.status} ${res.error}`)
        // 临时故障(限流/5xx/网络)才回滚记账让下轮重试;
        // 地址本身的问题重试多少次都一样,记录留着相当于永久跳过
        if (!res.permanent) {
          await deleteSent(db, person.id, entry.guid)
        }
      }
    }
  }

  // 预算用完:还有没发到的人,留给下一轮
  return { sent, failed, done: false }
}

async function run(env, { dryRun = false, bootstrap = false } = {}) {
  const db = env.DB
  const maxSends = Number(env.MAX_SENDS_PER_RUN) || DEFAULT_MAX_SENDS_PER_RUN
  const maxNew = Number(env.MAX_NEW_ENTRIES) || DEFAULT_MAX_NEW_ENTRIES

  const feedUrl = `${siteBase(env)}/newsletter.xml`
  const res = await fetch(feedUrl, { cf: { cacheTtl: 0 } })
  if (!res.ok) {
    await alertAdmin(env, "feed 拉取失败", `${feedUrl} → HTTP ${res.status}`)
    return { ok: false, reason: "feed_fetch_failed", status: res.status }
  }
  const entries = parseFeed(await res.text())
  if (!entries.length) {
    await alertAdmin(env, "feed 解析为空", `${feedUrl} 解析不出任何 item,疑似生成端出问题`)
    return { ok: false, reason: "feed_empty" }
  }

  const seen = await getSeenGuids(db)
  const fresh = entries.filter((e) => !seen.has(e.guid))

  // 保险 1:库是空的 = 第一次接管。把存量文章全部记为已见且已完成,一封不发。
  if (seen.size === 0 || bootstrap) {
    await markSeen(db, entries, { broadcast: true })
    return {
      ok: true,
      mode: "bootstrap",
      marked: entries.length,
      note: "存量文章已标记为已见,不发信。之后新发布的文章才会推送。",
    }
  }

  // 保险 3:一次冒出太多「新」文章,几乎一定是 guid 口径变了而不是真发了那么多
  if (fresh.length > maxNew) {
    await alertAdmin(
      env,
      "熔断:新文章数异常",
      `本轮检测到 ${fresh.length} 篇新文章(阈值 ${maxNew}),已中止群发。\n` +
        `多半是 slug/guid 口径变了导致老文章被当成新的。\n\n` +
        fresh.map((e) => `- ${e.title}\n  ${e.guid}`).join("\n") +
        `\n\n确认无误后,用 ?action=bootstrap 把它们标记为已见(不发信),` +
        `或手动删掉 seen_entries 里的错误记录。`,
    )
    return { ok: false, reason: "circuit_breaker", count: fresh.length }
  }

  if (fresh.length && !dryRun) {
    // 记为「已见但未广播」,进入待发队列
    await markSeen(db, fresh, { broadcast: false })
  }

  // 待发队列:本轮新增的 + 上一轮没发完的
  const queue = dryRun
    ? fresh.map((e) => ({ guid: e.guid, title: e.title }))
    : await pendingBroadcasts(db)

  const byGuid = new Map(entries.map((e) => [e.guid, e]))
  let budget = maxSends
  const report = []

  for (const item of queue) {
    if (budget <= 0) break
    const entry = byGuid.get(item.guid)
    if (!entry) {
      // 文章已经滚出 feed 窗口(比如 Worker 停了很久),没有正文可发,标记完成收摊
      if (!dryRun) await markBroadcastDone(db, item.guid)
      report.push({ title: item.title, skipped: "已滚出 feed 窗口" })
      continue
    }

    const result = await broadcastEntry(env, db, entry, budget, dryRun)
    budget -= result.sent + result.failed
    report.push({ title: entry.title, ...result })
    if (result.done && !dryRun) await markBroadcastDone(db, entry.guid)
  }

  return { ok: true, mode: dryRun ? "dry-run" : "live", budgetLeft: budget, report }
}

export default {
  // 定时触发:真正的群发入口
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env).then((r) => console.log("[newsletter]", JSON.stringify(r))))
  },

  // 手动运维入口。全部要 ADMIN_TOKEN,否则任何人都能触发群发。
  //   ?action=status     看订阅者分布和待发队列
  //   ?action=dry-run    演练:只报告会发给谁,不写库不发信
  //   ?action=bootstrap  把当前 feed 里的文章全标记为已见(不发信)
  //   ?action=run        立刻跑一次真实群发
  async fetch(request, env) {
    const url = new URL(request.url)
    const token = url.searchParams.get("token") || ""
    if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
      return new Response("forbidden", { status: 403 })
    }

    const action = url.searchParams.get("action") || "status"
    const json = (data) =>
      new Response(JSON.stringify(data, null, 2), {
        headers: { "content-type": "application/json; charset=utf-8" },
      })

    switch (action) {
      case "status":
        return json({
          subscribers: await countByStatus(env.DB),
          pending: await pendingBroadcasts(env.DB),
        })
      case "dry-run":
        return json(await run(env, { dryRun: true }))
      case "bootstrap":
        return json(await run(env, { bootstrap: true }))
      case "run":
        return json(await run(env))
      default:
        return new Response("unknown action", { status: 400 })
    }
  },
}
