// 双重确认的落地端点(Cloudflare Pages Function,路由 = /api/confirm)。
// 读者从确认邮件里点进来,验签通过就把 pending 转成 confirmed。
//
// 只认签名 token,不认邮箱明文参数 —— 否则 /api/confirm?email=someone@x.com
// 就能把任何人塞进名单(见 workers/newsletter/shared/tokens.js 的说明)。
import { confirmSubscriber } from "../../workers/newsletter/shared/db.js"
import { resultPage } from "../../workers/newsletter/shared/pages.js"
import { verifyToken } from "../../workers/newsletter/shared/tokens.js"

const COPY = {
  zh: {
    okTitle: "订阅成功",
    okBody: "以后有新文章,我会直接发到你的邮箱。每封邮件底部都有退订链接,随时可以退。",
    alreadyTitle: "已经确认过了",
    alreadyBody: "你的邮箱已经在订阅名单里,不用重复确认。",
    badTitle: "链接无效或已过期",
    badBody: "确认链接有效期 7 天。回到站点首页重新填一次邮箱就好。",
    errTitle: "出了点问题",
    errBody: "服务端暂时没能处理这个请求,过一会儿再试一次。",
  },
  en: {
    okTitle: "You're subscribed",
    okBody:
      "New posts will land in your inbox from now on. Every email has an unsubscribe link at the bottom.",
    alreadyTitle: "Already confirmed",
    alreadyBody: "This address is already on the list — no need to confirm again.",
    badTitle: "Invalid or expired link",
    badBody: "Confirmation links are valid for 7 days. Just subscribe again from the homepage.",
    errTitle: "Something went wrong",
    errBody: "We couldn't process that right now. Please try again in a moment.",
  },
}

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  // 邮件客户端不会带 referer,语言只能靠链接参数;没有就按中文
  const lang = url.searchParams.get("lang") === "en" ? "en" : "zh"
  const t = COPY[lang]

  if (!env.DB || !env.NEWSLETTER_SECRET) {
    console.error("[confirm] 缺少 DB 绑定或 NEWSLETTER_SECRET")
    return resultPage({ title: t.errTitle, message: t.errBody, lang, status: 500 })
  }

  const email = await verifyToken(
    env.NEWSLETTER_SECRET,
    url.searchParams.get("token") || "",
    "confirm",
  )
  if (!email) {
    return resultPage({ title: t.badTitle, message: t.badBody, lang, status: 400 })
  }

  let res
  try {
    res = await confirmSubscriber(env.DB, email)
  } catch (err) {
    console.error("[confirm] D1 写入失败", err)
    return resultPage({ title: t.errTitle, message: t.errBody, lang, status: 500 })
  }

  if (!res.ok) {
    // unknown(记录被删了)/ blocked(退信或投诉过)都当链接失效处理,
    // 不告诉对方具体原因 —— 那等于把名单状态泄漏给任何拿到链接的人
    return resultPage({ title: t.badTitle, message: t.badBody, lang, status: 400 })
  }

  return res.already
    ? resultPage({ title: t.alreadyTitle, message: t.alreadyBody, lang })
    : resultPage({ title: t.okTitle, message: t.okBody, lang })
}
