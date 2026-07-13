// 自托管的「不蒜子式」访问量计数 Worker(Cloudflare Worker + KV)。
//
// 提供三个计数:site_pv(全站总浏览)、site_uv(全站独立访客)、page_pv(本页浏览)。
// 客户端(quartz/static/busuanzi.js)在每次页面加载 / SPA 导航时 GET 本 Worker,
// 传当前路径,Worker 累加并返回三个数,客户端填进页面 span。
//
// 绑定:KV = COUNTER;Secret = SALT(哈希访客 IP 用,别进仓库)。
//
// 计数说明 / 取舍:
// - UV 用「加盐后的 IP 哈希」去重(存哈希、不存明文 IP,1 年 TTL),规避第三方 cookie
//   被浏览器拦截的问题(本 Worker 与博客不同源,cookie 方案不可靠)。
// - KV 非原子:高并发下 read-modify-write 可能少记几次。个人博客量级可接受(不蒜子本身
//   也非精确)。若日浏览 > ~几百、担心 KV 免费额度(1000 写/天),再上 Workers Paid 或
//   改 Durable Objects。
// - CORS 只放行博客自己的源。

const ALLOWED_ORIGINS = ["https://jz21.eu.org", "https://jz-quartz.pages.dev"]

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
    "Cache-Control": "no-store",
  }
}

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function incr(kv, key) {
  const cur = parseInt((await kv.get(key)) || "0", 10) || 0
  const next = cur + 1
  await kv.put(key, String(next))
  return next
}

async function read(kv, key) {
  return parseInt((await kv.get(key)) || "0", 10) || 0
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env)
    } catch (e) {
      console.error("busuanzi error:", e && e.stack ? e.stack : String(e))
      return new Response(JSON.stringify({ error: "counter unavailable" }), {
        status: 500,
        headers: {
          ...corsHeaders(request.headers.get("Origin") || ""),
          "Content-Type": "application/json",
        },
      })
    }
  },
}

async function handle(request, env) {
  const origin = request.headers.get("Origin") || ""
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  const url = new URL(request.url)
  let path = url.searchParams.get("path") || "/"
  try {
    path = decodeURIComponent(path)
  } catch {}
  path = path.split("?")[0].split("#")[0]
  if (path.length > 1) path = path.replace(/\/$/, "")
  const pageKey = "page_pv:" + path.slice(0, 512)

  const kv = env.COUNTER

  // UV:按加盐 IP 哈希做全站去重(首见才 +1)
  let site_uv
  const ip = request.headers.get("CF-Connecting-IP") || ""
  if (ip) {
    const uvKey = "uv_ip:" + (await sha256(ip + "|" + (env.SALT || "bsz")))
    if (await kv.get(uvKey)) {
      site_uv = await read(kv, "site_uv")
    } else {
      await kv.put(uvKey, "1", { expirationTtl: 31536000 })
      site_uv = await incr(kv, "site_uv")
    }
  } else {
    site_uv = await read(kv, "site_uv")
  }

  const site_pv = await incr(kv, "site_pv")
  const page_pv = await incr(kv, pageKey)

  return new Response(JSON.stringify({ site_uv, site_pv, page_pv }), {
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  })
}
