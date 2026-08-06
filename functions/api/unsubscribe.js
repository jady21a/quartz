// 退订端点(Cloudflare Pages Function,路由 = /api/unsubscribe)。
//
// 必须同时支持两种调用方式:
//   GET  —— 人从邮件底部点链接过来。**只给确认页,不退订**,退订发生在页面上那个按钮
//           POST 回来之后。GET 绝不能改状态:邮件里的链接会被预取(Gmail 代理、
//           Outlook Safe Links、公司邮件网关、杀毒扫描都会主动 GET),
//           一旦 GET 就退订,读者没点过也会被静默退掉,而且从后台看跟他自己退的一样。
//   POST —— 两个来源:邮件客户端的**一键退订**(RFC 8058,body 为 List-Unsubscribe=One-Click,
//           没人会看到页面,必须免登录立刻生效 —— Gmail 对批量发件人的硬性要求),
//           以及上面那个确认页的表单(带 source=web,要回一个页面给人看)。
//
// 两种方式都只认签名 token,不认邮箱明文,否则任何人都能枚举着把别人退掉。
import { unsubscribe } from "../../workers/newsletter/shared/db.js"
import { confirmPage, resultPage } from "../../workers/newsletter/shared/pages.js"
import { verifyToken } from "../../workers/newsletter/shared/tokens.js"

const COPY = {
  zh: {
    okTitle: "已退订",
    okBody: "以后不会再收到这个邮箱的推送了。如果哪天想回来,回站点首页重新订阅即可。",
    askTitle: "确认退订?",
    askBody: "点下面的按钮就不会再收到推送了。",
    askButton: "确认退订",
    badTitle: "链接无效",
    badBody: "这个退订链接不完整或已被改动。可以直接回复收到的那封邮件告诉我,我手动处理。",
    errTitle: "出了点问题",
    errBody: "服务端暂时没能处理这个请求,过一会儿再试一次。",
  },
  en: {
    okTitle: "Unsubscribed",
    okBody:
      "You won't receive any more emails at this address. You can always subscribe again from the homepage.",
    askTitle: "Unsubscribe?",
    askBody: "Click the button below and you'll stop receiving these emails.",
    askButton: "Confirm unsubscribe",
    badTitle: "Invalid link",
    badBody:
      "This unsubscribe link is incomplete or has been altered. Just reply to the email and I'll handle it manually.",
    errTitle: "Something went wrong",
    errBody: "We couldn't process that right now. Please try again in a moment.",
  },
}

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const lang = url.searchParams.get("lang") === "en" ? "en" : "zh"
  const t = COPY[lang]

  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("method not allowed", { status: 405 })
  }

  // 确认页那个表单带 source=web,一键退订不带 —— 用它区分「要页面」和「要纯 200」。
  // body 只读一次,后面不再用。
  let fromWebForm = false
  if (request.method === "POST") {
    const form = await request.formData().catch(() => null)
    fromWebForm = form?.get("source") === "web"
  }
  const isOneClick = request.method === "POST" && !fromWebForm

  if (!env.DB || !env.NEWSLETTER_SECRET) {
    console.error("[unsubscribe] 缺少 DB 绑定或 NEWSLETTER_SECRET")
    return isOneClick
      ? new Response("not configured", { status: 500 })
      : resultPage({ title: t.errTitle, message: t.errBody, lang, status: 500 })
  }

  const email = await verifyToken(
    env.NEWSLETTER_SECRET,
    url.searchParams.get("token") || "",
    "unsubscribe",
  )
  if (!email) {
    return isOneClick
      ? new Response("invalid token", { status: 400 })
      : resultPage({ title: t.badTitle, message: t.badBody, lang, status: 400 })
  }

  // token 有效,但这是 GET —— 只问,不动库。真正的退订在这个页面 POST 回来之后。
  if (request.method === "GET") {
    return confirmPage({
      title: t.askTitle,
      message: t.askBody,
      buttonLabel: t.askButton,
      action: url.pathname + url.search, // 带上 token 查询串,POST 回同一地址
      lang,
    })
  }

  try {
    await unsubscribe(env.DB, email)
  } catch (err) {
    console.error("[unsubscribe] D1 写入失败", err)
    return isOneClick
      ? new Response("error", { status: 500 })
      : resultPage({ title: t.errTitle, message: t.errBody, lang, status: 500 })
  }

  // 一键退订不看页面,回 200 就行;返回体给邮件客户端看,没有人读
  return isOneClick
    ? new Response("unsubscribed", { status: 200 })
    : resultPage({ title: t.okTitle, message: t.okBody, lang })
}
