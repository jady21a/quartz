// 退订端点(Cloudflare Pages Function,路由 = /api/unsubscribe)。
//
// 必须同时支持两种调用方式:
//   GET  —— 人从邮件底部点链接过来,给一个确认落地页
//   POST —— 邮件客户端的**一键退订**(RFC 8058)。Gmail/Yahoo 在邮件顶部显示的
//           那个"取消订阅"按钮,点下去是客户端直接 POST 这个地址,
//           body 为 List-Unsubscribe=One-Click,没有人会看到任何页面。
//           这条链路必须免登录、立刻生效 —— 这是 Gmail 对批量发件人的硬性要求。
//
// 两种方式都只认签名 token,不认邮箱明文,否则任何人都能枚举着把别人退掉。
import { unsubscribe } from "../../workers/newsletter/shared/db.js"
import { resultPage } from "../../workers/newsletter/shared/pages.js"
import { verifyToken } from "../../workers/newsletter/shared/tokens.js"

const COPY = {
  zh: {
    okTitle: "已退订",
    okBody: "以后不会再收到这个邮箱的推送了。如果哪天想回来,回站点首页重新订阅即可。",
    badTitle: "链接无效",
    badBody: "这个退订链接不完整或已被改动。可以直接回复收到的那封邮件告诉我,我手动处理。",
    errTitle: "出了点问题",
    errBody: "服务端暂时没能处理这个请求,过一会儿再试一次。",
  },
  en: {
    okTitle: "Unsubscribed",
    okBody:
      "You won't receive any more emails at this address. You can always subscribe again from the homepage.",
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
  const isOneClick = request.method === "POST"

  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("method not allowed", { status: 405 })
  }

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
