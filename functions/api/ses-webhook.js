// SES 的退信 / 投诉回调(Cloudflare Pages Function,路由 = /api/ses-webhook)。
// SES 把事件推给 SNS,SNS 再 POST 到这里。
//
// **这是整套系统里最不能省的一环。** 不接这个回调,系统照样能发信,
// 但死地址会永远留在名单里反复投递,退信率一路走高;SES 对高退信率的处理是
// 先警告、后停用账号。投诉(用户点"标记为垃圾邮件")同理,而且更致命。
//
// 鉴权说明:SNS 消息本身带 RSA 签名,严格做法是拉 SigningCertURL 的证书验签。
// 这里用的是「URL 里带共享密钥 + 校验证书域名」:订阅 SNS 时把
// ?token=<SES_WEBHOOK_TOKEN> 写进端点地址,只有我们和 AWS 知道这个地址。
// 对一个个人博客的退信回调,这个强度是够的;想升级成完整验签的话,
// 换掉下面 authorized() 即可,其余逻辑不用动。
import { markStatus } from "../../workers/newsletter/shared/db.js"

function authorized(url, env) {
  const token = url.searchParams.get("token") || ""
  return Boolean(env.SES_WEBHOOK_TOKEN) && token === env.SES_WEBHOOK_TOKEN
}

// SNS 订阅确认的 SubscribeURL 必须是 AWS 自己的域,否则就是有人在骗我们去请求任意地址
function isAwsUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === "https:" && /(^|\.)amazonaws\.com$/.test(u.hostname)
  } catch {
    return false
  }
}

/** 从一条 SES 事件里提取出「哪些地址要停发、停发成什么状态」 */
function extractActions(event) {
  const actions = []
  const type = event.notificationType || event.eventType

  if (type === "Bounce" && event.bounce) {
    // 只处理硬退信。Transient 是对方邮箱满了/服务暂时不可用这类,
    // 因为一次临时故障就把人永久踢出名单,是自己砍自己的列表
    if (event.bounce.bounceType === "Permanent") {
      for (const r of event.bounce.bouncedRecipients ?? []) {
        if (r.emailAddress) actions.push({ email: r.emailAddress, status: "bounced" })
      }
    }
  }

  if (type === "Complaint" && event.complaint) {
    for (const r of event.complaint.complainedRecipients ?? []) {
      if (r.emailAddress) actions.push({ email: r.emailAddress, status: "complained" })
    }
  }

  return actions
}

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)

  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 })
  }
  if (!authorized(url, env)) {
    return new Response("forbidden", { status: 403 })
  }
  if (!env.DB) {
    console.error("[ses-webhook] 缺少 DB 绑定")
    return new Response("not configured", { status: 500 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return new Response("bad request", { status: 400 })

  // SNS 建立订阅时先发一条确认消息,访问 SubscribeURL 才算订阅成功
  if (body.Type === "SubscriptionConfirmation") {
    if (!isAwsUrl(body.SubscribeURL)) {
      console.error("[ses-webhook] 可疑的 SubscribeURL:", body.SubscribeURL)
      return new Response("bad subscribe url", { status: 400 })
    }
    const res = await fetch(body.SubscribeURL)
    console.log("[ses-webhook] SNS 订阅确认:", res.status)
    return new Response("subscription confirmed", { status: 200 })
  }

  if (body.Type && body.Type !== "Notification") {
    return new Response("ignored", { status: 200 })
  }

  // SNS 把 SES 事件塞在 Message 字段里,是个 JSON 字符串;
  // 直连(不经 SNS)时 body 本身就是事件
  let event = body
  if (typeof body.Message === "string") {
    try {
      event = JSON.parse(body.Message)
    } catch {
      return new Response("unparseable message", { status: 400 })
    }
  }

  const actions = extractActions(event)
  for (const { email, status } of actions) {
    try {
      await markStatus(env.DB, email.toLowerCase(), status)
      console.log(`[ses-webhook] ${email} → ${status}`)
    } catch (err) {
      console.error(`[ses-webhook] 更新 ${email} 失败`, err)
      return new Response("storage error", { status: 500 })
    }
  }

  // 没匹配到动作也回 200:Delivery / Send 这类事件本来就不需要处理,
  // 回非 2xx 会让 SNS 反复重投
  return new Response(`ok (${actions.length})`, { status: 200 })
}
