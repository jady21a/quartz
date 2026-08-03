// 首页订阅的服务端中转(Cloudflare Pages Function,路由 = /api/subscribe)。
//
// 为什么要有这一层:页面原来直接 POST 到 Buttondown 的 embed-subscribe 端点,
// 浏览器会整页跳到 Buttondown 的落地页,而且 embed 端点一律走双重确认(double opt-in),
// 读者还得回邮箱点一次链接才算订阅成功 —— 两道门,转化掉一大截。
//
// 走官方 API 就能同时解决:
//   1. 请求由前端 fetch 到本站同源的这个函数,页面不跳转;
//   2. 建订阅者时带 type: "regular",Buttondown 跳过确认邮件,提交即订阅成功。
//
// 依赖:Cloudflare Pages 项目里配一个环境变量(建议存成 Secret)BUTTONDOWN_API_KEY。
// 没配也不会挂 —— 自动退回服务端调 embed 端点:页面依然不跳转,但确认邮件还在。
const BUTTONDOWN_API = "https://api.buttondown.com/v1/subscribers"
const BUTTONDOWN_EMBED = "https://buttondown.com/api/emails/embed-subscribe/WhyZ"

// 只接受来自本站页面的提交,挡掉直接拿这个端点当公开写接口刷订阅的。
// 预览域名 xxx.jz-quartz.pages.dev 也放行,方便上线前在预览环境点一遍。
const ALLOWED_HOSTS = [/^jz21\.eu\.org$/, /(^|\.)jz-quartz\.pages\.dev$/, /^localhost(:\d+)?$/]

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
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

  const email = (await readEmail(request)).trim()
  // 粗校验够用:真正的合法性以 Buttondown 的返回为准,这里只挡明显的空值/乱填。
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { ok: false, reason: "invalid_email" })
  }

  const apiKey = env.BUTTONDOWN_API_KEY
  if (!apiKey) {
    // 退路:服务端替浏览器提交 embed 表单。页面不跳转,但仍是双重确认。
    const form = new FormData()
    form.set("email", email)
    form.set("embed", "1")
    const res = await fetch(BUTTONDOWN_EMBED, { method: "POST", body: form, redirect: "manual" })
    const ok = res.status < 400
    return json(ok ? 200 : 502, { ok, needsConfirm: true, reason: ok ? undefined : "upstream" })
  }

  const res = await fetch(BUTTONDOWN_API, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      // 关键:regular 让 Buttondown 跳过确认邮件,直接置为已订阅。
      type: "regular",
      referrer_url: request.headers.get("referer") || undefined,
    }),
  })

  if (res.ok) {
    return json(200, { ok: true, needsConfirm: false })
  }

  const detail = await res.text().catch(() => "")
  // 重复订阅不是错误,对读者来说结果一样(已经在名单里了),按成功回复但换个文案。
  if (res.status === 400 && /already|exist|duplicate/i.test(detail)) {
    return json(200, { ok: true, already: true })
  }
  return json(502, { ok: false, reason: "upstream", status: res.status })
}
