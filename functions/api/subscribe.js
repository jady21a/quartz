// 首页订阅的服务端(Cloudflare Pages Function,路由 = /api/subscribe)。
//
// 原来这里是转发给 Buttondown 的。现在名单自持,存在本站的 D1(binding = DB),
// 发信走 SES(见 workers/newsletter/shared/mailer.js)。
//
// 与 Buttondown 版本最大的行为差异:**恢复了双重确认**。
// Buttondown 那版用 type:"regular" 故意跳过确认,图的是转化率。自建之后不能这么干:
//   1. 没有确认环节,任何人都能把别人的邮箱填进来,而退信/投诉全记在我们自己的发信域上;
//   2. Gmail/Yahoo 对批量发件人考核投诉率(<0.3%),名单不干净是直接后果;
//   3. Buttondown 有自己的 IP 池扛着,我们没有 —— 域信誉一旦烧掉,恢复很慢。
// 少掉的那点转化,换的是这个列表能长期发得出去。
//
// 需要在 Pages 项目上配:
//   D1 绑定 DB → newsletter 库
//   secret NEWSLETTER_SECRET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
//   变量 NEWSLETTER_FROM(如 hi@news.jz21.eu.org)、AWS_REGION、SITE_URL
import { requestSubscribe } from "../../workers/newsletter/shared/db.js"
import { sendMail } from "../../workers/newsletter/shared/mailer.js"
import { resultPage } from "../../workers/newsletter/shared/pages.js"
import { renderConfirm } from "../../workers/newsletter/shared/render.js"
import { signToken } from "../../workers/newsletter/shared/tokens.js"

// 只接受来自本站页面的提交,挡掉直接拿这个端点当公开写接口刷订阅的。
// 预览域名 xxx.jz-quartz.pages.dev 也放行,方便上线前在预览环境点一遍。
const ALLOWED_HOSTS = [/^jz21\.eu\.org$/, /(^|\.)jz-quartz\.pages\.dev$/, /^localhost(:\d+)?$/]

// 确认链接的有效期。太短会让"晚上才看邮箱"的人白填一次,太长则一个泄漏的链接长期可用
const CONFIRM_TTL_SECONDS = 7 * 24 * 3600

// 禁用 JS 时表单会直接 POST 过来(见 content/index.md 的 form action)。
// 那种情况下回 JSON 等于把一串裸 JSON 糊到读者脸上,得回一个正经页面。
const PAGE_COPY = {
  zh: {
    sentTitle: "确认信已发出",
    sentBody: "去邮箱点一下确认链接就订阅成功了。没看到的话翻一下垃圾邮件箱。",
    alreadyTitle: "已经订阅过了",
    alreadyBody: "这个邮箱已经在名单里,不用重复提交。",
    badTitle: "邮箱格式不对",
    badBody: "检查一下再填一次?",
    errTitle: "出了点问题",
    errBody: "服务端暂时没能处理这个请求,过一会儿再试一次。",
  },
  en: {
    sentTitle: "Check your inbox",
    sentBody:
      "Click the confirmation link we just sent. If it's not there, check your spam folder.",
    alreadyTitle: "Already subscribed",
    alreadyBody: "This address is already on the list.",
    badTitle: "Invalid email",
    badBody: "That doesn't look like a valid address — mind checking it?",
    errTitle: "Something went wrong",
    errBody: "We couldn't process that right now. Please try again in a moment.",
  },
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  })
}

// fetch 过来的请求带 content-type: application/json;裸表单提交则是 form-urlencoded
function wantsHtml(request) {
  const type = request.headers.get("content-type") || ""
  return !type.includes("application/json")
}

function respond(request, lang, status, jsonBody, pageKey) {
  if (!wantsHtml(request)) return json(status, jsonBody)
  const copy = PAGE_COPY[lang] ?? PAGE_COPY.zh
  return resultPage({
    title: copy[`${pageKey}Title`],
    message: copy[`${pageKey}Body`],
    lang,
    status,
  })
}

function isSameSite(request) {
  const origin = request.headers.get("origin") || request.headers.get("referer")
  if (!origin) return false
  try {
    const host = new URL(origin).host
    return ALLOWED_HOSTS.some((re) => re.test(host))
  } catch {
    return false
  }
}

// 中英同一棵树、按 /en 前缀分语言(与 static/subscribe.js、LanguageSwitch 判断一致)
function langFromReferer(request) {
  const referer = request.headers.get("referer")
  if (!referer) return "zh"
  try {
    const path = new URL(referer).pathname
    return path === "/en" || path.startsWith("/en/") ? "en" : "zh"
  } catch {
    return "zh"
  }
}

async function readEmail(request) {
  const type = request.headers.get("content-type") || ""
  if (type.includes("application/json")) {
    const body = await request.json().catch(() => ({}))
    return typeof body.email === "string" ? body.email : ""
  }
  const form = await request.formData().catch(() => null)
  return form ? String(form.get("email") || "") : ""
}

export async function onRequest(context) {
  const { request, env } = context

  // 只收 POST;别的方法直接拒掉,避免这个路径被爬。
  if (request.method !== "POST") {
    return json(405, { ok: false, reason: "method_not_allowed" })
  }
  if (!isSameSite(request)) {
    return json(403, { ok: false, reason: "forbidden" })
  }

  const lang = langFromReferer(request)
  const email = (await readEmail(request)).trim().toLowerCase()
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(request, lang, 400, { ok: false, reason: "invalid_email" }, "bad")
  }

  if (!env.DB || !env.NEWSLETTER_SECRET) {
    console.error("[subscribe] 缺少 DB 绑定或 NEWSLETTER_SECRET")
    return respond(request, lang, 500, { ok: false, reason: "not_configured" }, "err")
  }

  let result
  try {
    result = await requestSubscribe(env.DB, {
      email,
      lang,
      source: request.headers.get("referer") || null,
    })
  } catch (err) {
    console.error("[subscribe] D1 写入失败", err)
    return respond(request, lang, 500, { ok: false, reason: "storage" }, "err")
  }

  if (result.action === "already") {
    return respond(request, lang, 200, { ok: true, already: true }, "already")
  }

  // blocked(退信过/投诉过)对外也回"已发确认信":
  // 任何按邮箱区分的回复都会让这个端点变成"某人在不在名单里"的查询工具
  if (result.shouldSend) {
    const token = await signToken(env.NEWSLETTER_SECRET, email, "confirm", CONFIRM_TTL_SECONDS)
    const base = (env.SITE_URL || "https://jz21.eu.org").replace(/\/$/, "")
    const confirmUrl = `${base}/api/confirm?token=${encodeURIComponent(token)}`
    const mail = renderConfirm({ confirmUrl, lang })

    const sent = await sendMail(env, {
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    })
    if (!sent.ok) {
      console.error(`[subscribe] 确认信发送失败 ${email}: ${sent.status} ${sent.error}`)
      return respond(request, lang, 502, { ok: false, reason: "mail_failed" }, "err")
    }
  }

  return respond(request, lang, 200, { ok: true, needsConfirm: true }, "sent")
}
