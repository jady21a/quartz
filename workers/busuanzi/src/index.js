// 自托管的「不蒜子式」访问量计数 Worker(Cloudflare Worker + KV)+ 私密统计面板。
//
// 计数(公开,给博客用):
//   提供三个计数:site_pv(全站总浏览)、site_uv(全站独立访客)、page_pv(本页浏览)。
//   客户端(quartz/static/busuanzi.js)在每次页面加载 / SPA 导航时 GET 本 Worker,
//   传当前路径,Worker 累加并返回三个数,客户端填进页面 span。
//   额外:同时累加「日别桶」(d_pv:YYYY-MM-DD / d_uv:YYYY-MM-DD),用于面板画趋势。
//
// 统计面板(私密,只给站长本人):
//   GET /stats#token=XXX  → HTML 壳页,公开返回(不含数据);前端从 URL fragment 读 token,
//                           以 Authorization: Bearer 头请求数据。fragment 不进服务端日志。
//   GET /stats.json       → 面板数据(站点 PV/UV、每页 PV 排行、日趋势,以及可选的
//                           Cloudflare 边缘 zone 数据)。鉴权:Bearer 头(或兼容 ?token=)。
//   token 与 env.STATS_TOKEN 常数时间比对,不匹配 → 401。面板不被搜索引擎收录。
//
// 绑定:KV = COUNTER;Secret = SALT(哈希访客 IP);Secret = STATS_TOKEN(面板口令)。
// 可选(接 Cloudflare 边缘数据):Secret = CF_API_TOKEN(带 Account/Zone Analytics 读),
//   Var = CF_ZONE_TAG(jz21.eu.org 的 zone id,不填则用 CF_ZONE_NAME 自动发现)。
//
// 计数说明 / 取舍:
// - UV 用「加盐后的 IP 哈希」去重(存哈希、不存明文 IP,1 年 TTL),规避第三方 cookie
//   被浏览器拦截的问题(本 Worker 与博客不同源,cookie 方案不可靠)。
// - KV 非原子:高并发下 read-modify-write 可能少记几次。个人博客量级可接受。
// - CORS 只放行博客自己的源。面板端点不参与 CORS(同源直接浏览器打开)。
// - 只有 Origin 在白名单里的请求才计数(浏览器跨域 fetch 必带 Origin);裸 GET
//   (扫描器/curl)只回读数不累加——count.* 域名会进证书透明度日志,扫描流量不小。
//   挡不住刻意伪造 Origin 的刷量,个人站量级够用。

const ALLOWED_ORIGINS = ["https://jz21.eu.org", "https://jz-quartz.pages.dev"]
const CF_ZONE_NAME = "jz21.eu.org"

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

async function incr(kv, key, ttl) {
  const cur = parseInt((await kv.get(key)) || "0", 10) || 0
  const next = cur + 1
  await kv.put(key, String(next), ttl ? { expirationTtl: ttl } : undefined)
  return next
}

async function read(kv, key) {
  return parseInt((await kv.get(key)) || "0", 10) || 0
}

// 常数时间字符串比对,避免口令被计时攻击猜出来。
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false
  const enc = new TextEncoder()
  const ba = enc.encode(a)
  const bb = enc.encode(b)
  if (ba.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i]
  return diff === 0
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url)
      if (url.pathname === "/stats") return handleStatsPage()
      if (url.pathname === "/stats.json") return handleStatsData(request, env)
      if (url.pathname === "/stats/snapshot") return handleSnapshot(request, env)
      if (url.pathname === "/stats/platforms") return handlePlatforms(request, env)
      return await handleCount(request, env)
    } catch (e) {
      console.error("busuanzi error:", e && e.stack ? e.stack : String(e))
      return new Response(JSON.stringify({ error: "unavailable" }), {
        status: 500,
        headers: {
          ...corsHeaders(request.headers.get("Origin") || ""),
          "Content-Type": "application/json",
        },
      })
    }
  },

  // 定时任务(Cron Trigger,见 wrangler.toml [triggers]):每天快照 CF 边缘日别数据。
  async scheduled(event, env, ctx) {
    try {
      const n = await snapshotCloudflareDaily(env)
      console.log("cf snapshot ok:", n, "days")
    } catch (e) {
      console.error("cf snapshot error:", e && e.stack ? e.stack : String(e))
    }
  },
}

// ───────────────────────── 计数(公开) ─────────────────────────
async function handleCount(request, env) {
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
  const day = todayUTC()
  // 日别桶(d_pv/d_uv)永久保存,不设 TTL —— 保留全部历史趋势。

  // Origin 不在白名单 → 只读不计数(见文件头注释)。
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
      JSON.stringify({
        site_uv: await read(kv, "site_uv"),
        site_pv: await read(kv, "site_pv"),
        page_pv: await read(kv, pageKey),
      }),
      { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  // UV:按加盐 IP 哈希做全站去重(首见才 +1);同时记「当天首见」做日 UV。
  let site_uv
  const ip = request.headers.get("CF-Connecting-IP") || ""
  let ipHash = ""
  if (ip) {
    ipHash = await sha256(ip + "|" + (env.SALT || "bsz"))
    const uvKey = "uv_ip:" + ipHash
    if (await kv.get(uvKey)) {
      site_uv = await read(kv, "site_uv")
    } else {
      await kv.put(uvKey, "1", { expirationTtl: 31536000 })
      site_uv = await incr(kv, "site_uv")
    }
    // 日 UV:当天该 IP 首见才 +1(短 TTL 的当天去重标记)
    const uvDayKey = "uvd:" + day + ":" + ipHash
    if (!(await kv.get(uvDayKey))) {
      await kv.put(uvDayKey, "1", { expirationTtl: 60 * 60 * 48 })
      await incr(kv, "d_uv:" + day) // 永久桶,不设 TTL
    }
  } else {
    site_uv = await read(kv, "site_uv")
  }

  const site_pv = await incr(kv, "site_pv")
  const page_pv = await incr(kv, pageKey)
  await incr(kv, "d_pv:" + day) // 日 PV 桶(永久,不设 TTL)

  return new Response(JSON.stringify({ site_uv, site_pv, page_pv }), {
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  })
}

// ───────────────────────── 统计数据(私密) ─────────────────────────
function checkToken(request, env) {
  // 首选 Authorization: Bearer(token 不进 URL / 日志);兼容旧的 ?token= 查询串。
  const auth = request.headers.get("Authorization") || ""
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  const url = new URL(request.url)
  const token = bearer || url.searchParams.get("token") || ""
  return !!env.STATS_TOKEN && safeEqual(token, env.STATS_TOKEN)
}

// 列出某前缀下所有 key(小站量级,单页 1000 足够)
async function listPrefix(kv, prefix) {
  const out = []
  let cursor
  do {
    const res = await kv.list({ prefix, limit: 1000, cursor })
    out.push(...res.keys.map((k) => k.name))
    cursor = res.list_complete ? undefined : res.cursor
  } while (cursor)
  return out
}

async function handleStatsData(request, env) {
  if (!checkToken(request, env)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }
  const kv = env.COUNTER

  const site_pv = await read(kv, "site_pv")
  const site_uv = await read(kv, "site_uv")

  // 每页 PV 排行
  const pageKeys = await listPrefix(kv, "page_pv:")
  const pages = await Promise.all(
    pageKeys.map(async (k) => ({
      path: k.slice("page_pv:".length),
      pv: await read(kv, k),
    })),
  )
  pages.sort((a, b) => b.pv - a.pv)

  // 日趋势(自有桶,从加桶那天起累积)
  const pvKeys = await listPrefix(kv, "d_pv:")
  const uvKeys = await listPrefix(kv, "d_uv:")
  const byDay = {}
  for (const k of pvKeys) byDay[k.slice("d_pv:".length)] = { pv: await read(kv, k), uv: 0 }
  for (const k of uvKeys) {
    const d = k.slice("d_uv:".length)
    ;(byDay[d] ||= { pv: 0, uv: 0 }).uv = await read(kv, k)
  }
  const daily = Object.entries(byDay)
    .map(([date, v]) => ({ date, pv: v.pv, uv: v.uv }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  // Cloudflare 边缘 zone 数据(可选,需 CF_API_TOKEN):KPI/维度分解用实时 30 天查询。
  let cf = null
  let cfError = null
  if (env.CF_API_TOKEN) {
    try {
      cf = await fetchCloudflare(env)
    } catch (e) {
      cfError = String(e && e.message ? e.message : e)
    }
  }

  // CF 边缘「日趋势」改读定时快照攒下来的全部历史(不受套餐保留期限制)。
  const cfDaily = await readCfDaily(kv)

  // 平台账号数据:本机推上来的最新一份,没推过就是 null。
  let platforms = null
  try {
    const raw = await kv.get("plat:latest")
    if (raw) platforms = JSON.parse(raw)
  } catch {
    platforms = null
  }

  return new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      platforms,
      site: { pv: site_pv, uv: site_uv },
      pages,
      daily,
      cf,
      cfDaily,
      cfError,
    }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  )
}

// 手动触发一次快照(Bearer token 鉴权),用于部署后立刻回填初始历史 / 排障。
async function handleSnapshot(request, env) {
  if (!checkToken(request, env)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }
  try {
    const n = await snapshotCloudflareDaily(env)
    return new Response(JSON.stringify({ ok: true, days: n }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    )
  }
}

// ───────────────────────── 平台账号数据(本机推送) ─────────────────────────
// B站/YouTube/小红书的数字由本机 ~/info-digest 定时 POST 上来,Worker 只存不抓:
// 创作中心要 SESSDATA,那种长期有效的登录态不该躺在一个公网 Worker 的 secret 里。
// 只收数字,不收标题/封面/bvid —— 面板的平台区是死胡同,不给任何点进内容的出口。
async function handlePlatforms(request, env) {
  if (!checkToken(request, env)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }
  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }
  if (!body || !Array.isArray(body.platforms)) {
    return new Response(JSON.stringify({ error: "expected {fetchedAt, platforms:[]}" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }
  // receivedAt 由服务端盖章:本机时钟错了(或推送卡在半路)时,新鲜度判断不该跟着错。
  const rec = {
    fetchedAt: body.fetchedAt || null,
    receivedAt: new Date().toISOString(),
    platforms: body.platforms,
  }
  await env.COUNTER.put("plat:latest", JSON.stringify(rec))
  return new Response(JSON.stringify({ ok: true, platforms: body.platforms.length }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
}

// ───────────────────────── Cloudflare zone GraphQL ─────────────────────────
async function resolveZoneTag(env) {
  if (env.CF_ZONE_TAG) return env.CF_ZONE_TAG
  const r = await fetch(
    "https://api.cloudflare.com/client/v4/zones?name=" + encodeURIComponent(CF_ZONE_NAME),
    { headers: { Authorization: "Bearer " + env.CF_API_TOKEN } },
  )
  const j = await r.json()
  if (!j.success || !j.result || !j.result[0]) {
    throw new Error("zone lookup failed: " + JSON.stringify(j.errors || j))
  }
  return j.result[0].id
}

async function fetchCloudflare(env) {
  const zoneTag = await resolveZoneTag(env)
  const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)
  const until = todayUTC()
  const query = `
    query ($zoneTag: String!, $since: String!, $until: String!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 60
            filter: { date_geq: $since, date_leq: $until }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            uniq { uniques }
            sum {
              requests
              pageViews
              bytes
              threats
              countryMap { clientCountryName requests }
              browserMap { uaBrowserFamily pageViews }
              responseStatusMap { edgeResponseStatus requests }
            }
          }
        }
      }
    }`
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.CF_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { zoneTag, since, until } }),
  })
  const j = await r.json()
  if (j.errors && j.errors.length) throw new Error(JSON.stringify(j.errors))
  const groups = j?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || []

  const daily = groups.map((g) => ({
    date: g.dimensions.date,
    requests: g.sum.requests,
    pageViews: g.sum.pageViews,
    uniques: g.uniq.uniques,
    bytes: g.sum.bytes,
    threats: g.sum.threats,
  }))

  const agg = (mapName, keyField, valField) => {
    const m = {}
    for (const g of groups) {
      for (const row of g.sum[mapName] || []) {
        m[row[keyField]] = (m[row[keyField]] || 0) + row[valField]
      }
    }
    return Object.entries(m)
      .map(([k, v]) => ({ name: k, value: v }))
      .sort((a, b) => b.value - a.value)
  }

  return {
    zoneTag,
    since,
    until,
    daily,
    totals: {
      requests: daily.reduce((s, d) => s + d.requests, 0),
      pageViews: daily.reduce((s, d) => s + d.pageViews, 0),
      uniques: daily.reduce((s, d) => s + d.uniques, 0),
      bytes: daily.reduce((s, d) => s + d.bytes, 0),
    },
    countries: agg("countryMap", "clientCountryName", "requests").slice(0, 12),
    browsers: agg("browserMap", "uaBrowserFamily", "pageViews").slice(0, 8),
    status: agg("responseStatusMap", "edgeResponseStatus", "requests").slice(0, 8),
  }
}

// 轻量:只取 CF 边缘日别数字(requests/pageViews/uniques/bytes/threats),给定时快照用。
async function fetchCfDaily(env, zoneTag, since, until) {
  const query = `
    query ($zoneTag: String!, $since: String!, $until: String!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 60
            filter: { date_geq: $since, date_leq: $until }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            uniq { uniques }
            sum { requests pageViews bytes threats }
          }
        }
      }
    }`
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.CF_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { zoneTag, since, until } }),
  })
  const j = await r.json()
  if (j.errors && j.errors.length) throw new Error(JSON.stringify(j.errors))
  const groups = j?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || []
  return groups.map((g) => ({
    date: g.dimensions.date,
    requests: g.sum.requests,
    pageViews: g.sum.pageViews,
    uniques: g.uniq.uniques,
    bytes: g.sum.bytes,
    threats: g.sum.threats,
  }))
}

// 每天定时把最近 30 天的 CF 边缘日别数据「upsert」进 KV(cfd:YYYY-MM-DD,永久不设 TTL)。
// 回查 30 天可自愈补洞、并把昨天/前几天的临时数据更正为最终值;因为只增不删,累积历史
// 会超出 CF 免费套餐的保留期,面板即可展示全部历史。
async function snapshotCloudflareDaily(env) {
  if (!env.CF_API_TOKEN) return 0
  const zoneTag = await resolveZoneTag(env)
  const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)
  const until = todayUTC()
  const daily = await fetchCfDaily(env, zoneTag, since, until)
  for (const d of daily) {
    await env.COUNTER.put(
      "cfd:" + d.date,
      JSON.stringify({
        requests: d.requests,
        pageViews: d.pageViews,
        uniques: d.uniques,
        bytes: d.bytes,
        threats: d.threats,
      }),
    ) // 无 expirationTtl = 永久保存
  }
  return daily.length
}

// 读回累积的 CF 边缘日趋势(全部历史,按日期升序)。
async function readCfDaily(kv) {
  const keys = await listPrefix(kv, "cfd:")
  const rows = await Promise.all(
    keys.map(async (k) => {
      let o = {}
      try {
        o = JSON.parse((await kv.get(k)) || "{}") || {}
      } catch {}
      return { date: k.slice("cfd:".length), ...o }
    }),
  )
  return rows.sort((a, b) => (a.date < b.date ? -1 : 1))
}

// ───────────────────────── 面板 HTML(公开壳页,数据靠 token) ─────────────────────────
function handleStatsPage() {
  // 壳页本身不含任何数据,公开返回;鉴权在 /stats.json 上。
  return new Response(STATS_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}

const STATS_HTML = `<!DOCTYPE html>
<html lang="zh"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Why Z · 数据面板</title>
<style>
  :root{
    --bg:#0f1115; --card:#191c23; --line:#272b34; --fg:#e8eaed; --mut:#9aa3b2;
    --acc:#7aa2f7; --acc2:#9ece6a; --warn:#e0af68;
  }
  @media (prefers-color-scheme: light){
    :root{ --bg:#f6f7f9; --card:#fff; --line:#e6e8ec; --fg:#1c2027; --mut:#69707d;
      --acc:#3b6fe0; --acc2:#3f9142; --warn:#b9820f; }
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);
    font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
    -webkit-font-smoothing:antialiased;padding:24px 16px 64px}
  .wrap{max-width:1000px;margin:0 auto}
  header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px}
  h1{font-size:20px;margin:0;font-weight:700;letter-spacing:.2px}
  .sub{color:var(--mut);font-size:13px}
  .grid{display:grid;gap:14px}
  .kpis{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
  .kpi .n{font-size:30px;font-weight:700;letter-spacing:.5px}
  .kpi .l{color:var(--mut);font-size:12px;margin-top:2px}
  .kpi .h{color:var(--mut);font-size:11px;margin-top:6px}
  h2{font-size:14px;margin:0 0 12px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.6px}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th,td{text-align:left;padding:7px 6px;border-bottom:1px solid var(--line)}
  th{color:var(--mut);font-weight:600;font-size:12px}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  tr:last-child td{border-bottom:none}
  .path{max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  /* PV 排行的长尾:默认藏起来,展开只切 class,不重画表 —— 单表才能保证展开前后列宽一致 */
  .pvrank .more{display:none}
  .pvrank.open .more{display:table-row}
  /* 表尾吸底:展开 130 行之后,「收起」不能只长在表的最下面 —— 那等于逼人滑到底
     才能关掉。sticky 的作用域天然限在这张卡内,滚出 PV 排行就自己松开,不会变成
     一条永远赖在屏幕底下的横条。 */
  .rank-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;
    font-size:12.5px;position:sticky;bottom:0;background:var(--card);
    border-top:1px solid var(--line);padding:9px 0 1px}
  .more-btn{background:none;border:none;color:var(--acc);font-size:12.5px;
    cursor:pointer;padding:2px 0;font-family:inherit}
  .more-btn:hover{text-decoration:underline}
  .trunc{margin-top:8px;font-size:12px;color:var(--mut)}
  a{color:var(--acc);text-decoration:none}
  a:hover{text-decoration:underline}
  .bar{height:6px;border-radius:3px;background:var(--acc);opacity:.85}
  .two{grid-template-columns:1fr 1fr}
  @media(max-width:720px){.two{grid-template-columns:1fr}.path{max-width:60vw}}
  .muted{color:var(--mut)}
  .note{font-size:12.5px;color:var(--warn);background:rgba(224,175,104,.08);
    border:1px solid rgba(224,175,104,.3);border-radius:10px;padding:10px 12px;margin-bottom:14px}
  .chart{width:100%;height:150px;display:block}
  /* 悬停读数。竖线吸附到最近的数据点上,不跟着光标像素走 —— 图上只有那些点是真的,
     停在两点之间读出来的数会是编的。 */
  .chartbox{position:relative}
  .chartbox .cursor{position:absolute;top:6px;bottom:24px;width:1px;background:var(--fg);
    opacity:.35;display:none;pointer-events:none}
  .chartbox .tip{position:absolute;top:2px;display:none;pointer-events:none;z-index:3;
    background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px 9px;
    font-size:12px;line-height:1.55;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.18)}
  .chartbox .tip .dt{color:var(--mut);font-size:11px;margin-bottom:1px}
  .chartbox .tip .r{display:flex;align-items:center;gap:6px}
  .chartbox .tip .r b{margin-left:14px;font-variant-numeric:tabular-nums}
  .legend{display:flex;gap:14px;font-size:12px;color:var(--mut);margin-top:6px}
  .dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:middle}
  button.refresh{background:var(--card);color:var(--fg);border:1px solid var(--line);
    border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer}
  button.refresh:hover{border-color:var(--acc)}
  .err{color:#f7768e}
  /* 平台账号区 */
  .sect{display:flex;align-items:baseline;gap:10px;margin:0 0 12px}
  .sect h3{font-size:15px;margin:0;font-weight:700}
  .sect .hint{font-size:12px;color:var(--mut)}
  .sect .rule{flex:1;height:1px;background:var(--line)}
  /* 整区一个时间戳。四张卡来自同一次推送,四个一样的「1 小时前」只是把右上角占满。 */
  .sect .stamp{font-size:11.5px;color:var(--mut);white-space:nowrap}
  .sect .stamp.stale{color:var(--warn)}
  .plat-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:14px}
  .plat-name{font-size:15px;font-weight:700}
  .badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);
    color:var(--mut);white-space:nowrap}
  .badge.stale{color:var(--warn);border-color:rgba(224,175,104,.45);background:rgba(224,175,104,.1)}
  /* 固定 4 列 = MAX_MAJOR,主区正好占满整行。不用 auto-fit:各平台主指标数不同
     (小红书只有 2 个),自适应会让每张卡的列宽都不一样,数字左边缘跨卡对不齐、
     没法竖着扫 —— 竖着扫正是这四张卡并排的意义(第 4 列固定是待回复)。 */
  .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px 10px}
  /* 窄屏 2 列:四个数排成 2×2 方阵;3 列会变成 3+1,末行孤零零挂一个。 */
  @media(max-width:720px){.metrics{grid-template-columns:repeat(2,1fr)}}
  /* 数值、标签、日增在各自那一格里居中,三者对同一条中轴 —— 左对齐时数字长度不一
     (483 / 35,177),下面的标签跟着左边缘走,整行看着像没对齐。 */
  .m{text-align:center}
  .m .v{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.3px}
  .m .k{font-size:11.5px;color:var(--mut);margin-top:1px}
  .m .d{font-size:11px;color:var(--acc2);margin-top:2px;font-variant-numeric:tabular-nums}
  .m .d.zero{color:var(--mut)}
  .m .d.ph{visibility:hidden}
  /* 掉粉必须一眼看出来。跟日增柱图里 v<0 那根同色 —— 同一件事在这页只有一种颜色。 */
  .m .d.neg{color:var(--warn)}
  /* 队列型指标(还剩多少没处理)攒下东西了就染橙:它是这页唯一需要动手的数,
     但没事干的时候不该有任何视觉重量,所以为 0 时和别的指标长得一模一样。 */
  .m .v.hot{color:var(--warn)}
  /* 面板上唯一可点的数字。下划线是虚的:它要看起来像个待办,不像导航 ——
     这页其余部分一个出口都没有,这一个必须自己解释自己。 */
  .m .v a{color:inherit;text-decoration:underline dotted;text-underline-offset:3px}
  .m .v a:hover{text-decoration-style:solid}
  /* 次区:不动的累计数压成一行小字。和「平台口径」那行长得像但没有虚线分隔 ——
     它和上面的大数字同属「累计」这一块,虚线之后才是「当日」。 */
  .minor{margin-top:12px;display:flex;gap:8px 14px;flex-wrap:wrap;font-size:12.5px}
  .minor .t{color:var(--mut);margin-right:2px}
  .minor b{font-variant-numeric:tabular-nums;font-weight:600}
  .today{margin-top:14px;padding-top:12px;border-top:1px dashed var(--line);
    display:flex;gap:8px 18px;flex-wrap:wrap;font-size:13px}
  .today .t{color:var(--mut);font-size:12px;margin-right:2px}
  .today b{font-variant-numeric:tabular-nums}
  @media(max-width:720px){.today{gap:6px 12px}.minor{gap:6px 12px}}
  .stale .metrics,.stale .minor,.stale .today{opacity:.45}
  .offcard{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .offcard .why{font-size:12.5px;color:var(--mut);max-width:70ch}
</style></head>
<body><div class="wrap">
  <header>
    <div><h1>Why Z · 数据面板</h1><div class="sub" id="sub">加载中…</div></div>
    <button class="refresh" onclick="load()">刷新</button>
  </header>
  <div id="app"><div class="card muted">加载中…</div></div>
</div>
<script>
// token 放 URL fragment(#token=):不会随请求发给服务器、不进任何访问日志。
// 兼容旧书签的 ?token=:读到后立刻迁移进 fragment 并抹掉查询串。
let token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
const legacyTok = new URLSearchParams(location.search).get('token');
if (!token && legacyTok) {
  token = legacyTok;
  history.replaceState(null, '', location.pathname + '#token=' + encodeURIComponent(token));
}
const fmt = n => (n==null?'—':n.toLocaleString('en-US'));
const bytes = n => { if(n==null) return '—'; const u=['B','KB','MB','GB','TB']; let i=0,v=n;
  while(v>=1024&&i<u.length-1){v/=1024;i++} return v.toFixed(i?1:0)+' '+u[i]; };
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// 两张图共用画布尺寸,但 x 映射不同:折线的点落在两端边界上(xAt),柱子必须
// 各占一个槽、居中画(xBand),否则首尾两根柱子会有一半被 viewBox 切掉。
const CW=680, CH=150, CP=24;
const xAt=(i,n)=> CP + (n===1? (CW-2*CP)/2 : i*(CW-2*CP)/(n-1));
const xBand=(i,n)=> CP + (i+0.5)*(CW-2*CP)/n;

// 发布日竖线。marks 是点位下标(由渲染侧按日期匹配算好,见 markIdx),
// x 用所在图自己的映射传进来 —— 竖线必须和它那张图的柱子/拐点对齐。
// 画在数据之前 = 压在折线/柱子底下,是背景参照物,不该抢视线。
function markLines(marks, x){
  return (marks||[]).map(i=>'<line x1="'+x(i).toFixed(1)+'" y1="10" x2="'+x(i).toFixed(1)+
    '" y2="'+(CH-CP)+'" stroke="var(--warn)" stroke-width="1" stroke-dasharray="4 4" opacity=".65"/>').join('');
}

// 日期数组里哪些天发了片。只认精确相等 —— 序列是逐日连续的,发布日要么在窗口里
// 要么在窗口外,不做插值猜位置。
function markIdx(dates, releases){
  if(!releases||!releases.length) return [];
  const set=new Set(releases), out=[];
  dates.forEach((d,i)=>{ if(set.has(d)) out.push(i) });
  return out;
}

// 图是 SVG 字符串拼出来的,没有可以挂事件的数据点对象。所以把「这张图画的是什么」
// 原样挂在容器的 data-tip 上,交互时再解析 —— 读数和线条共用同一份数字,不会各说各的。
// band=true 表示 x 用槽坐标(柱子),false 是端点坐标(折线),反查下标要按各自的映射来。
function chartBox(svg, tip){
  return '<div class="chartbox" data-tip="'+esc(JSON.stringify(tip))+'">'+svg+
    '<div class="cursor"></div><div class="tip"></div></div>';
}

function lineChart(series, colors, labels, opts){
  // series: array of {values:[...]} aligned to same x; simple SVG line chart
  const W=CW,H=CH,P=CP, n=series[0].values.length;
  if(n===0) return '<div class="muted">暂无数据</div>';
  let max=0; series.forEach(s=>s.values.forEach(v=>{if(v>max)max=v}));
  // 这里只画流量类(PV/请求/每日播放),0 基线本身有意义,不做 y 轴收窄。
  // 累计量(粉丝/订阅)不走这条路 —— 从 0 起画必然压成直线,改由 barChart 画日增。
  const lo=0, hi=max||1;
  const x=i=> xAt(i,n);
  const y=v=> H-P - (v-lo)/(hi-lo)*(H-2*P);
  let paths=markLines(opts&&opts.marks, x);
  series.forEach((s,si)=>{
    const d=s.values.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
    paths+='<path d="'+d+'" fill="none" stroke="'+colors[si]+'" stroke-width="2" stroke-linejoin="round"/>';
    if(n===1) paths+='<circle cx="'+x(0)+'" cy="'+y(s.values[0])+'" r="3" fill="'+colors[si]+'"/>';
  });
  // x labels: first & last
  const lab='<text x="'+P+'" y="'+(H-4)+'" fill="var(--mut)" font-size="10">'+labels[0]+'</text>'+
    '<text x="'+(W-P)+'" y="'+(H-4)+'" fill="var(--mut)" font-size="10" text-anchor="end">'+labels[n-1]+'</text>'+
    '<text x="2" y="12" fill="var(--mut)" font-size="10">'+fmt(hi)+'</text>';
  return chartBox('<svg class="chart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+paths+lab+'</svg>',
    {band:false, dates:labels, series:series.map(function(s,i){
      return {name:s.name||'', values:s.values, color:colors[i]} })});
}

// 日增用柱状而不是折线:0 基线在这里有实义(那天一个粉没涨),而且日增会是负数,
// 掉粉那天必须看得出来是往下扎的 —— 累计折线永远单调上升,把掉粉藏没了。
function barChart(values, color, labels, opts){
  const n=values.length;
  if(n===0) return '<div class="muted">暂无数据</div>';
  let max=0,min=0;                        // 从 0 起夹,保证零线一定落在画布内
  values.forEach(v=>{ if(v>max)max=v; if(v<min)min=v });
  if(max===min) max=min+1;                // 整段全 0:零线贴底、柱子全是零高,如实显示「一个没涨」
  const y=v=> CH-CP - (v-min)/(max-min)*(CH-2*CP);
  const x=i=> xBand(i,n);
  const zero=y(0), bw=Math.max(2,(CW-2*CP)/n*0.55);
  let bars='';
  values.forEach((v,i)=>{
    const yy=y(v), top=Math.min(yy,zero), h=Math.abs(yy-zero);
    bars+='<rect x="'+(x(i)-bw/2).toFixed(1)+'" y="'+top.toFixed(1)+'" width="'+bw.toFixed(1)+
      '" height="'+h.toFixed(1)+'" fill="'+(v<0?'var(--warn)':color)+'" rx="1" opacity=".75"/>';
    // 日增本来就是个位数,看刻度不如直接看数字。有均线时不写,免得挤成一团。
    if(n<=14 && !(opts&&opts.avg)) bars+='<text x="'+x(i).toFixed(1)+'" y="'+(top-3).toFixed(1)+
      '" fill="var(--mut)" font-size="10" text-anchor="middle">'+v+'</text>';
  });
  const axis='<line x1="'+CP+'" y1="'+zero.toFixed(1)+'" x2="'+(CW-CP)+'" y2="'+zero.toFixed(1)+
    '" stroke="var(--line)" stroke-width="1"/>';
  // 均线画在柱子之上:柱子答「哪天真涨了」,均线答「这阵子整体在往哪走」。
  // 虚线 + 与柱子同色 —— 和双轴图那条日增均线一套画法,两张图之间不用重新认。
  const ad=(opts&&opts.avg)? brokenPath(opts.avg,x,y) : '';
  const avg=ad?'<path d="'+ad+'" fill="none" stroke="var(--acc2)" stroke-width="1.5" '+
    'stroke-dasharray="5 3" stroke-linejoin="round"/>':'';
  const lab='<text x="'+CP+'" y="'+(CH-4)+'" fill="var(--mut)" font-size="10">'+labels[0]+'</text>'+
    '<text x="'+(CW-CP)+'" y="'+(CH-4)+'" fill="var(--mut)" font-size="10" text-anchor="end">'+labels[n-1]+'</text>';
  const tipSeries=[{name:(opts&&opts.name)||'', values:values, color:color}];
  if(opts&&opts.avg) tipSeries.push({name:'7 日均', values:opts.avg, color:'var(--acc2)'});
  return chartBox('<svg class="chart" viewBox="0 0 '+CW+' '+CH+'" preserveAspectRatio="none">'+
    markLines(opts&&opts.marks,x)+axis+bars+avg+lab+'</svg>',
    {band:true, dates:labels, series:tipSeries});
}

// 折线穿过缺口:两条序列的时间窗口不一样长(播放攒了 30 天,涨粉才 5 天),
// 并到同一条时间轴上就必然有半截没数据。null 处断笔,不要把缺口连成一条假线。
function brokenPath(values, x, y){
  let d='', pen=false;
  values.forEach((v,i)=>{
    if(v==null){ pen=false; return }
    d+=(pen?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)+' ';
    pen=true;
  });
  return d.trim();
}

// 双 y 轴:左轴每日播放(折线),右轴日增粉(柱子),共用一条时间轴。
//
// 这类图有个绕不开的毛病:两侧刻度各定各的,「柱子比折线高」什么都不说明 ——
// 把任一侧刻度改一改就能编出相反的故事。所以两侧最大值都标出来、并按序列配色。
// 它只能用来看「同一天两边各自怎么动」,不能用来看「谁比谁多」。
function comboChart(dates, line, bars, labels, opts){
  const n=dates.length;
  if(!n) return '<div class="muted">暂无数据</div>';
  const x=i=> xBand(i,n);            // 有柱子就统一用槽坐标,折线也落在槽中心
  let lmax=0; line.values.forEach(v=>{ if(v!=null&&v>lmax)lmax=v }); lmax=lmax||1;
  let rmax=0,rmin=0;                 // 右轴从 0 起夹,容得下掉粉的负值
  bars.values.forEach(v=>{ if(v==null)return; if(v>rmax)rmax=v; if(v<rmin)rmin=v });
  if(rmax===rmin) rmax=rmin+1;
  // 两条轴必须共用同一条零线,否则画面里会出现两条不同高度的「0」,没法看。
  // 先按右轴定零线的相对高度 f,再把左轴的下界挪到同一位置。
  const f=(0-rmin)/(rmax-rmin);
  const llo=(f>0&&f<0.99)? -f*lmax/(1-f) : 0;
  const ly=v=> CH-CP - (v-llo)/(lmax-llo)*(CH-2*CP);
  const ry=v=> CH-CP - (v-rmin)/(rmax-rmin)*(CH-2*CP);
  const zero=ry(0), bw=Math.max(2,(CW-2*CP)/n*0.55);
  let rects='';
  bars.values.forEach((v,i)=>{
    if(v==null) return;
    const yy=ry(v), top=Math.min(yy,zero), h=Math.abs(yy-zero);
    rects+='<rect x="'+(x(i)-bw/2).toFixed(1)+'" y="'+top.toFixed(1)+'" width="'+bw.toFixed(1)+
      '" height="'+h.toFixed(1)+'" fill="'+(v<0?'var(--warn)':'var(--acc2)')+'" rx="1" opacity=".75"/>';
  });
  const d=brokenPath(line.values, x, ly);
  const path=d?'<path d="'+d+'" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round"/>':'';
  // 日增均线走右轴,所以颜色跟柱子一致(绑定轴归属),再用虚线跟左轴那条实线折线区分开。
  const ad=bars.avg? brokenPath(bars.avg, x, ry) : '';
  const avg=ad?'<path d="'+ad+'" fill="none" stroke="var(--acc2)" stroke-width="1.5" '+
    'stroke-dasharray="5 3" stroke-linejoin="round"/>':'';
  const axis='<line x1="'+CP+'" y1="'+zero.toFixed(1)+'" x2="'+(CW-CP)+'" y2="'+zero.toFixed(1)+
    '" stroke="var(--line)" stroke-width="1"/>';
  // 左上=左轴上限,右上=右轴上限,颜色跟各自的序列走 —— 双轴图不标死刻度就是在骗人
  const lab='<text x="2" y="12" fill="var(--acc)" font-size="10">'+fmt(lmax)+'</text>'+
    '<text x="'+(CW-2)+'" y="12" fill="var(--acc2)" font-size="10" text-anchor="end">'+fmt(rmax)+'</text>'+
    (rmin<0?'<text x="'+(CW-2)+'" y="'+(CH-CP)+'" fill="var(--acc2)" font-size="10" text-anchor="end">'+
      fmt(rmin)+'</text>':'')+
    '<text x="'+CP+'" y="'+(CH-4)+'" fill="var(--mut)" font-size="10">'+labels[0]+'</text>'+
    '<text x="'+(CW-CP)+'" y="'+(CH-4)+'" fill="var(--mut)" font-size="10" text-anchor="end">'+labels[n-1]+'</text>';
  const tipSeries=[{name:line.name||'', values:line.values, color:'var(--acc)'},
                   {name:bars.name||'', values:bars.values, color:'var(--acc2)'}];
  if(bars.avg) tipSeries.push({name:'7 日均', values:bars.avg, color:'var(--acc2)'});
  return chartBox('<svg class="chart" viewBox="0 0 '+CW+' '+CH+'" preserveAspectRatio="none">'+
    markLines(opts&&opts.marks,x)+axis+rects+avg+path+lab+'</svg>',
    {band:true, dates:dates.map(function(d){ return d.slice(5) }), series:tipSeries});
}

function barTable(rows, valFmt){
  if(!rows||!rows.length) return '<div class="muted">暂无数据</div>';
  const max=Math.max(...rows.map(r=>r.value))||1;
  return '<table><tbody>'+rows.map(r=>
    '<td class="path">'+esc(r.name||'(未知)')+'</td>'+
    '<td style="width:40%"><div class="bar" style="width:'+Math.max(4,r.value/max*100).toFixed(1)+'%"></div></td>'+
    '<td class="num">'+(valFmt?valFmt(r.value):fmt(r.value))+'</td>'
  ).map(x=>'<tr>'+x+'</tr>').join('')+'</tbody></table>';
}

// ───────── 平台账号区 ─────────
// 数据由本机 info-digest 推来。超过这个小时数没有新数据就判定「推送挂了」。
// 本机一天推两次(08:30 / 18:30),最长间隔是晚班到早班的 14 小时 —— 阈值必须大于它,
// 否则每天早上 06:30-08:30 都会误报一次。假警报报几次人就开始无视它,真挂的那次也一起无视。
const STALE_HOURS = 15;

function ago(ms){
  const m=Math.round(ms/6e4);
  if(m<60) return m+' 分钟前';
  const h=m/60; if(h<48) return (h<10?h.toFixed(1):Math.round(h))+' 小时前';
  return Math.round(h/24)+' 天前';
}

// 队列型指标:「还剩多少没处理」,不是累计量。取数侧同名常量见
// ~/info-digest/scripts/fetch_stats.py 的 QUEUE_LABELS —— 那边据此不给它算 delta
// (「较昨日 -3」对待办数只是噪音),这边据此决定它排主区还是次区。
const QUEUE_LABELS = new Set(['未读回复','待回评论','待回 issue'])

// 主指标:每天真的会变、真的会看的那几个。其余(硬币/评论/分享/弹幕/仓库数…)
// 是几乎不动的累计数,同样 22px 粗体只是在稀释真正要看的东西 —— B站一张卡九个
// 大数字,眼睛落哪儿全凭运气,手机上更是挤成三行。
const PRIMARY_LABELS = new Set([
  '粉丝','订阅','播放','获赞与收藏','Star','下载',   // 涨没涨、有没有人看
  '点赞','收藏','视频','Fork',                       // 凑够四个:内容反馈 / 产出量
])
// 主区最多四个。多了就等于没分主次,而且四个正好在手机上排成 2×2。
const MAX_MAJOR = 4

function platCard(p, fetchedAt, now){
  if(!p.enabled || !p.ok){
    return '<div class="card offcard">'+
      '<div><div class="plat-name">'+esc(p.name||'')+'</div>'+
      '<div class="why">'+esc(p.why||'未接入')+'</div></div>'+
      '<span class="badge">未接入</span></div>';
  }
  const age=now-new Date(fetchedAt).getTime();
  const stale=!(age>=0) || age>STALE_HOURS*3600e3;
  // 正常时卡上不挂时间戳(整区一个,见 platformSection);只有这张卡的数可能过期了才说话。
  const badge=stale? '<span class="badge stale">数据可能已停更 · '+ago(age)+'</span>' : '';
  // 待办常驻主区,不按有没有事浮动:0 也要占着那一格,它说的是「查过了,没有」——
  // 一个会消失的指标,不在的时候人分不清是没事还是没取到数。
  // 但「占位」和「抢眼」是两回事:染橙、给链接仍然只在非零时(见下面的 hot)。
  const isQueue=function(m){ return QUEUE_LABELS.has(m.label) };
  const hot=function(m){ return isQueue(m) && !!m.value };
  const rows=p.totals||[];
  // 名额有限时待办先占位,剩下的按取数侧给的原顺序填 —— 主区读起来还是平台自己的排法。
  const queue=rows.filter(isQueue);
  const prim=rows.filter(function(m){ return PRIMARY_LABELS.has(m.label) && !isQueue(m) });
  let major=prim.slice(0, Math.max(0, MAX_MAJOR-queue.length)).concat(queue);
  // 兜底:将来接的平台如果一个主指标都没命中(比如换了叫法),别把整张卡压成小字。
  if(!major.length) major=rows.slice(0, MAX_MAJOR);
  const inMajor=new Set(major);
  const minor=rows.filter(function(m){ return !inMajor.has(m) });
  // 这张卡只要有一个格子带日增,没日增的格子就补一条等高的空行 —— 否则「粉丝」那格
  // 多出一行,同排其他格子被顶得参差不齐,手机上尤其明显。
  const pad=major.some(function(m){ return m.delta!=null })? '<div class="d ph">&nbsp;</div>' : '';

  let h='<div class="card'+(stale?' stale':'')+'">';
  h+='<div class="plat-head"><span class="plat-name">'+esc(p.name||'')+'</span>'+badge+'</div>';
  h+='<div class="metrics">'+major.map(function(m){
      const d=m.delta;
      // 平台区是死胡同 —— 唯一的例外是队列型指标,而且只在它不为 0 时:看到 1 之后该做的事
      // 就是点进去回掉它,拦在这里等于逼人去 App 里翻,反而更糟。0 的时候不给链接、也不染色:
      // 没事干的时候更不该有出口。取数侧只给「待办清单」类 URL(筛选后的列表),不给具体内容页。
      const q=hot(m);
      const v=(q&&m.url)? '<a href="'+esc(m.url)+'" target="_blank" rel="noopener">'+fmt(m.value)+'</a>'
                        : fmt(m.value);
      return '<div class="m"><div class="v'+(q?' hot':'')+'">'+v+'</div>'+
        '<div class="k">'+esc(m.label)+'</div>'+
        (d==null? pad : '<div class="d'+(d?(d<0?' neg':''):' zero')+'">'+(d>0?'+':'')+d+' 较昨日</div>')+
        '</div>';
    }).join('')+'</div>';
  // 次区:一行小字带过。不显示日增 —— 会看日增的指标本来就该在主区。
  if(minor.length){
    h+='<div class="minor">'+minor.map(function(m){
      return '<span><span class="t">'+esc(m.label)+'</span> <b>'+fmt(m.value)+'</b></span>';
    }).join('')+'</div>';
  }
  if(p.today&&p.today.length){
    // 标签用平台自己的日期,不写「今日」:B站的 incr_* 实测是 T-1(当天早上甚至还是 T-2),
    // 写成「今日」等于每天骗自己一次,也是我们自算 delta 和它对不上的原因。
    const dl=p.officialDate? p.officialDate.slice(5).replace('-','/') : '平台口径';
    h+='<div class="today"><span class="t">'+esc(dl)+' 平台口径:</span>'+
      p.today.map(function(m){
        return '<span><span class="t">'+esc(m.label)+'</span> <b>'+fmt(m.value)+'</b></span>';
      }).join('')+'</div>';
  }
  h+='</div>';
  return h;
}

function platformSection(pd, now){
  const stamp=pd&&(pd.fetchedAt||pd.receivedAt);
  const age=stamp? now-new Date(stamp).getTime() : NaN;
  const stale=!(age>=0) || age>STALE_HOURS*3600e3;
  // 时间戳收在区标题这一处:全区共用同一次推送,写四遍不会让它更新得更勤。
  const st=(age>=0)? '<span class="stamp'+(stale?' stale':'')+'">'+ago(age)+'</span>' : '';
  let h='<div class="sect"><h3>平台账号</h3>'+
    '<span class="hint">只有数字,没有出口 —— 看完就关</span><span class="rule"></span>'+st+'</div>';
  if(!pd){
    h+='<div class="card muted">本机还没推过数据。跑 <b>~/info-digest/run.sh</b>,'+
       '并在 config/secrets.env 里填 <b>STATS_TOKEN</b>。</div>';
    return h;
  }
  const on=(pd.platforms||[]).filter(function(p){return p.enabled&&p.ok});
  if(on.length && stale){
    h+='<div class="note">本机已 '+ago(age)+' 没推新数据(阈值 '+STALE_HOURS+' 小时)。'+
       '下面是旧数字,别当今天的看 —— 多半是 <b>com.jz.info-digest</b> 没跑成:'+
       '机器休眠挂起、或 SESSDATA 过期。</div>';
  }
  h+='<div class="grid" style="grid-template-columns:1fr;margin-bottom:14px">'+
     (pd.platforms||[]).map(function(p){return platCard(p,stamp,now)}).join('')+'</div>';

  // 平台趋势:每个平台各画一张,序列不够长就不画(两个点的折线只会误导)
  const cards=[];
  const card=function(title,n,svg){
    return '<div class="card"><h2>'+esc(title)+
      ' <span class="muted" style="font-weight:400">('+n+' 天)</span></h2>'+svg+'</div>';
  };
  // 粉丝/订阅推上来的是累计值,但累计曲线只会单调上升,看不出哪天发力。
  // 就地差分成日增,才和「每日播放」同为流量口径、能跟发布日竖线对上。
  const dailyGain=function(s){
    const pts=s.points||[], out=[];
    for(let i=1;i<pts.length;i++) out.push({date:pts[i].date, value:pts[i].value-pts[i-1].value});
    return {label:'日增'+s.label, points:out};
  };
  // 并成一条时间轴。注意只并「出现过的日期」,不补日历空洞 —— 真断了几天的话
  // x 轴会把那段压掉,不会假装那几天存在。
  const unionDates=function(lists){
    const set={};
    lists.forEach(function(pts){ pts.forEach(function(x){ set[x.date]=1 }) });
    return Object.keys(set).sort();
  };
  const alignTo=function(dates,pts){
    const m={}; pts.forEach(function(x){ m[x.date]=x.value });
    return dates.map(function(d){ return (d in m)? m[d] : null });
  };
  // 日增天然是 0,0,3,0,1 这种噪声,攒长了就是一排锯齿、读不出趋势。
  // 7 日均线专管趋势,柱子继续管「哪天真涨了」。窗口比数据还长时没有意义,
  // 所以卡在 14 个点(两个完整窗口)才开始画 —— 现在不显示,攒够了自己亮出来。
  const AVG_W=7, AVG_MIN=14;
  const movingAvg=function(pts){
    if(pts.length<AVG_MIN) return null;
    const out=[];
    for(let i=AVG_W-1;i<pts.length;i++){
      let s=0; for(let j=i-AVG_W+1;j<=i;j++) s+=pts[j].value;
      out.push({date:pts[i].date, value:Math.round(s/AVG_W*10)/10});
    }
    return out;
  };
  // 图例三平台共用一套写法:同一个视觉元素(绿柱=日增、虚线=均线、竖线=发布日)
  // 在哪张图上都是同一个意思,换个平台不用重新认。
  // 发布日按窗口里有没有真的画出竖线来决定标不标 —— 图例里出现画面上没有的东西,
  // 会让人以为「这几天一条片都没发」和「这张图不画发布日」是同一件事。
  const legendItems=function(items){
    return '<div class="legend">'+items.filter(Boolean).join('')+'</div>';
  };
  const dotItem=function(color,text){
    return '<span><span class="dot" style="background:'+color+'"></span>'+esc(text)+'</span>';
  };
  const avgItem=function(hasAvg){
    return hasAvg? '<span style="color:var(--acc2)">┄ 7 日均</span>' : '';
  };
  const markItem=function(hasMarks){
    return hasMarks? '<span style="color:var(--warn)">┆ 发布日</span>' : '';
  };
  const legend=function(a,b,hasAvg,hasMarks){
    return legendItems([dotItem('var(--acc)',a+'(左轴)'), dotItem('var(--acc2)',b+'(右轴)'),
      avgItem(hasAvg), markItem(hasMarks)]);
  };
  (pd.platforms||[]).forEach(function(p){
    const rel=p.releases||[], ser=p.series||[];
    const pick=function(fn){ return ser.filter(fn)[0] };
    const plays=pick(function(s){return s.label==='每日播放'});
    const fansSrc=pick(function(s){return s.label==='粉丝'||s.label==='订阅'});
    // 日增有两个来源,平台口径优先:YouTube Analytics 直接按天给
    // subscribersGained/Lost;拿不到的平台才退回「本地累计快照就地差分」——
    // 后者漏抓一天就会把两天并成一根柱子,能不用就不用。
    const gainDirect=pick(function(s){return s.label.indexOf('日增')===0});
    const gain=gainDirect || (fansSrc? dailyGain(fansSrc) : null);
    const gainAvg=gain? movingAvg(gain.points) : null;
    // 累计粉丝/订阅永远不单独画:单调上升的线看不出哪天发力,它的位置由日增图顶替。
    const done=[];
    if(fansSrc) done.push(fansSrc.label);
    if(gainDirect) done.push(gainDirect.label);
    // 两条都够长才叠成双轴:一条流量一条日增,同一时间轴上才看得出
    // 「发片 → 播放起来 → 涨粉」这条链子哪一环断了。
    if(plays&&(plays.points||[]).length>=3&&gain&&gain.points.length>=3){
      const dates=unionDates([plays.points,gain.points]);
      const labs=dates.map(function(x){return x.slice(5)});
      cards.push(card(p.name+' · 播放 × '+gain.label, dates.length,
        comboChart(dates,
          {name:plays.label, values:alignTo(dates,plays.points)},
          {name:gain.label, values:alignTo(dates,gain.points), avg:gainAvg?alignTo(dates,gainAvg):null},
          labs, {marks:markIdx(dates,rel)})+
        legend(plays.label,gain.label,!!gainAvg,!!markIdx(dates,rel).length)));
      done.push(plays.label);
    } else if(gain && gain.points.length>=3){
      // 只有日增、没有播放(或播放太短):单画一张柱图。四天历史才够三根柱子。
      const g=gain.points, gd=g.map(function(x){return x.date}), gm=markIdx(gd,rel);
      // 柱子用 --acc2:和双轴图里那排日增柱同色。这张图只是「双轴图缺了播放那半」,
      // 不是另一种图,颜色跟着含义走、不跟着图种走。
      cards.push(card(p.name+' · '+gain.label, g.length,
        barChart(g.map(function(x){return x.value}),'var(--acc2)',
          gd.map(function(x){return x.slice(5)}),
          {marks:gm, avg:gainAvg?alignTo(gd,gainAvg):null, name:gain.label})+
        legendItems([dotItem('var(--acc2)',gain.label), avgItem(!!gainAvg), markItem(!!gm.length)])));
    }
    // 访问 × 克隆:同一时间轴上分辨「有人来」和「被爬」。
    //
    // GitHub 的 traffic 接口只给每天的次数和来源数,没有 UA、没有 IP,单次克隆是谁
    // 它不说 —— 所以「这些克隆里几次是爬虫」在数据层面拆不出来,拆了就是编。
    // 但爬虫不看网页:2026-08-13 jady21a/quartz 被克隆 338 次、284 个不同来源,
    // 同一天仓库页浏览量是 0。所以不去替读数的人下结论,只把两条线并到一起,
    // 让读法自己浮出来:一起动 = 真有人克隆;克隆冲天而访问贴地 = 爬虫扫过去了。
    // 双轴图「谁比谁高」本来就不可比(见 comboChart 的注释),而这里要看的恰好是
    // 「同一天两边各自怎么动」—— 正好是它唯一能回答的问题。
    const views=pick(function(s){return s.label==='每日访问'});
    const clones=pick(function(s){return s.label==='每日克隆'});
    if(views&&clones&&(views.points||[]).length>=3&&(clones.points||[]).length>=3){
      const vdates=unionDates([views.points,clones.points]);
      const vmarks=markIdx(vdates,rel);
      cards.push(card(p.name+' · 访问 × 克隆', vdates.length,
        comboChart(vdates,
          {name:views.label, values:alignTo(vdates,views.points)},
          {name:clones.label, values:alignTo(vdates,clones.points)},
          vdates.map(function(x){return x.slice(5)}), {marks:vmarks})+
        legend(views.label,clones.label,false,!!vmarks.length)));
      done.push(views.label, clones.label);
    }
    ser.forEach(function(s){
      if(done.indexOf(s.label)>=0) return;   // 已经画过了(并进双轴图,或被日增图顶替)
      const pts=s.points||[];
      if(pts.length<3) return;
      const dates=pts.map(function(x){return x.date}), lm=markIdx(dates,rel);
      cards.push(card(p.name+' · '+s.label, pts.length,
        lineChart([{name:s.label, values:pts.map(function(x){return x.value})}],['var(--acc)'],
          dates.map(function(x){return x.slice(5)}),{marks:lm})+
        legendItems([dotItem('var(--acc)',s.label), markItem(!!lm.length)])));
    });
  });
  if(cards.length){
    h+='<div class="grid two" style="margin-bottom:22px">'+cards.join('')+'</div>';
  }
  return h;
}

async function load(){
  const app=document.getElementById('app');
  app.innerHTML='<div class="card muted">加载中…</div>';
  let d;
  if(!token){
    app.innerHTML='<div class="card err">缺少口令 —— 在地址后面加 <b>#token=你的口令</b> 再打开。</div>';
    return;
  }
  try{
    const r=await fetch('/stats.json',{cache:'no-store',headers:{Authorization:'Bearer '+token}});
    if(r.status===401){app.innerHTML='<div class="card err">401 未授权 —— token 不对。</div>';return;}
    d=await r.json();
  }catch(e){ app.innerHTML='<div class="card err">加载失败:'+esc(e.message||e)+'</div>'; return; }

  document.getElementById('sub').textContent='更新于 '+new Date(d.generatedAt).toLocaleString('zh-CN');
  let h='';

  // ① 平台账号:放最前。10 秒瞄一眼要看的是粉丝和评论,不是博客 PV。
  h+=platformSection(d.platforms, Date.now());

  // ② 站点流量:两类口径必须分区,不然平台播放量和站点 PV 会看串。
  h+='<div class="sect"><h3>站点流量</h3><span class="hint">jz21.eu.org</span>'+
     '<span class="rule"></span></div>';

  // KPIs
  const cf=d.cf;
  // busuanzi 一个上报都没有时,别拿三个干巴巴的 0 冒充「真的没人看」——多半是前端没在上报。
  const bszEmpty = !d.site.pv && !d.site.uv;
  const bszHint = t => bszEmpty ? '尚未收到上报' : t;
  h+='<div class="grid kpis" style="margin-bottom:14px">';
  h+=kpi(fmt(d.site.pv),'累计浏览 PV',bszHint('busuanzi · 真人'));
  h+=kpi(fmt(d.site.uv),'累计访客 UV',bszHint('IP 去重'));
  h+=kpi(fmt(d.pages.length),'被访问页面数',bszHint('有 PV 记录'));
  if(cf){
    // 「边缘请求」不做 KPI:它主要由每页挂多少静态资源决定(换字体/加图就涨),对「有多少人看」
    // 几乎无信息量,还容易被误读成访问量。基础设施压力看「流量」卡;异常扫描看趋势图里的请求线。
    h+=kpi(fmt(cf.totals.pageViews),'边缘页面浏览 30d','Cloudflare · 含爬虫');
    h+=kpi(fmt(cf.totals.uniques),'边缘独立 IP 30d','Cloudflare');
    h+=kpi(bytes(cf.totals.bytes),'流量 30d','Cloudflare');
  }
  h+='</div>';

  // busuanzi 零上报提示(区分「没人看」和「压根没在计数」)
  if(bszEmpty){
    h+='<div class="note">busuanzi 自有计数为 0 —— 页面没有在上报。检查博客 '+
       '<b>quartz/components/Head.tsx</b> 里的 <b>enableBusuanzi</b> 是否为 true、且已重新构建部署;'+
       '右边 Cloudflare 的数字来自边缘日志,与此无关,所以照常有数。</div>';
  }

  // CF 未接入提示
  if(!cf){
    h+='<div class="note">Cloudflare 边缘数据未接入'+(d.cfError?(':'+esc(d.cfError)):'')+
       '。给 worker 设 <b>CF_API_TOKEN</b>(带 Zone Analytics 读权限)即可自动出现国家/趋势/请求量。当前仅展示 busuanzi 自有计数。</div>';
  }

  // 趋势图
  h+='<div class="grid two" style="margin-bottom:14px">';
  // busuanzi 日趋势
  const bd=d.daily;
  h+='<div class="card"><h2>每日趋势 · busuanzi(真人)</h2>';
  if(bd.length){
    h+=lineChart(
      [{name:'PV',values:bd.map(x=>x.pv)},{name:'UV',values:bd.map(x=>x.uv)}],
      ['var(--acc)','var(--acc2)'],
      bd.map(x=>x.date.slice(5)));
    h+='<div class="legend"><span><span class="dot" style="background:var(--acc)"></span>PV</span>'+
       '<span><span class="dot" style="background:var(--acc2)"></span>UV</span></div>';
  } else h+='<div class="muted">日别桶从今天起累积,明天开始有趋势。</div>';
  h+='</div>';
  // CF 日趋势:优先用定时快照攒下的全部历史,回退到实时 30 天查询。
  const cfd=(d.cfDaily&&d.cfDaily.length)?d.cfDaily:(cf?cf.daily:[]);
  h+='<div class="card"><h2>每日趋势 · Cloudflare 边缘'+
     (cfd.length?' <span class="muted" style="font-weight:400">('+cfd.length+' 天)</span>':'')+'</h2>';
  if(cfd.length){
    h+=lineChart(
      [{name:'请求',values:cfd.map(x=>x.requests||0)},
       {name:'页面浏览',values:cfd.map(x=>x.pageViews||0)},
       {name:'独立 IP',values:cfd.map(x=>x.uniques||0)}],
      ['var(--acc)','var(--warn)','var(--acc2)'],
      cfd.map(x=>x.date.slice(5)));
    h+='<div class="legend"><span><span class="dot" style="background:var(--acc)"></span>请求</span>'+
       '<span><span class="dot" style="background:var(--warn)"></span>页面浏览</span>'+
       '<span><span class="dot" style="background:var(--acc2)"></span>独立 IP</span></div>';
  } else h+='<div class="muted">未接入 CF,或定时快照尚未开始累积。</div>';
  h+='</div>';
  h+='</div>';

  // 每页 PV 排行。默认只摊开前 HEAD 条:这张表要回答的是「哪几页在扛流量」,
  // 第 11 名往后是一水儿几个 PV 的长尾,平时纯占屏。剩下的收进折叠,展开就给全部 ——
  // 上一版停在 50 条且一声不吭,和上面 KPI「被访问页面数」当面对不上。
  const HEAD=10, CAP=200;
  h+='<div class="card pvrank" style="margin-bottom:14px"><h2>页面 PV 排行(busuanzi)'+
     (d.pages.length?' <span class="muted" style="font-weight:400">(共 '+fmt(d.pages.length)+' 页)</span>':'')+
     '</h2>';
  if(d.pages.length){
    const max=d.pages[0].pv||1;
    const shown=d.pages.slice(0,CAP), rest=d.pages.slice(CAP);
    const sum=function(a){ return a.reduce(function(s,p){return s+(p.pv||0)},0) };
    const total=sum(d.pages)||1;
    h+='<table><thead><tr><th>页面</th><th></th><th class="num">PV</th></tr></thead><tbody>';
    h+=shown.map(function(p,i){
      const url='https://jz21.eu.org'+(p.path==='/'?'':p.path);
      return '<tr'+(i>=HEAD?' class="more"':'')+'>'+
        '<td class="path"><a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(p.path)+'</a></td>'+
        '<td style="width:35%"><div class="bar" style="width:'+Math.max(4,p.pv/max*100).toFixed(1)+'%"></div></td>'+
        '<td class="num">'+fmt(p.pv)+'</td></tr>';
    }).join('');
    h+='</tbody></table>';
    // 头尾比例是这张表唯一的结论性信息(流量到底是集中还是摊平),省得自己按计算器。
    const n=Math.min(HEAD,d.pages.length);
    h+='<div class="rank-foot"><span class="muted">前 '+n+' 页占 '+
       Math.round(sum(d.pages.slice(0,HEAD))/total*100)+'% 的 PV</span>';
    if(shown.length>HEAD){
      h+='<button class="more-btn" onclick="toggleRank(this)" data-n="'+(shown.length-HEAD)+'">'+
         '展开剩余 '+(shown.length-HEAD)+' 条 ▾</button>';
    }
    h+='</div>';
    if(rest.length){
      // 真超过 CAP 才截断,而且明说 —— 静默丢掉是上一版的毛病,别换个数字重犯一遍。
      h+='<div class="trunc">另有 '+fmt(rest.length)+' 页未列出(每页 PV ≤ '+fmt(rest[0].pv)+
         ',合计 '+fmt(sum(rest))+')。</div>';
    }
  } else h+='<div class="muted">暂无页面记录。</div>';
  h+='</div>';

  // CF 维度分解
  if(cf){
    h+='<div class="grid two">';
    h+='<div class="card"><h2>访客国家 / 地区 30d</h2>'+barTable(cf.countries)+'</div>';
    h+='<div class="card"><h2>浏览器 30d</h2>'+barTable(cf.browsers)+'</div>';
    h+='</div>';
    h+='<div class="card" style="margin-top:14px"><h2>响应状态码 30d</h2>'+barTable(cf.status)+'</div>';
  }

  app.innerHTML=h;
  initTips();   // 图是刚写进 DOM 的,事件只能在这之后挂
}
// 悬停读数。SVG 是 preserveAspectRatio="none" 横向拉满的,所以像素 → viewBox 是线性的:
// 按容器宽度折算回 viewBox 坐标,再按各图自己的 x 映射反查最近的下标。
// 只在有鼠标的设备上生效(触屏不触发 mousemove),手机上图还是图,不假装能点。
function initTips(){
  document.querySelectorAll('.chartbox').forEach(function(box){
    let tip;
    try{ tip=JSON.parse(box.dataset.tip||'') }catch(e){ return }
    if(!tip||!tip.dates||!tip.dates.length) return;
    const cur=box.querySelector('.cursor'), el=box.querySelector('.tip'), n=tip.dates.length;
    box.addEventListener('mousemove', function(ev){
      const r=box.getBoundingClientRect();
      if(!r.width) return;
      // 反解 xAt / xBand:先去掉两侧留白,归一化到 0..1,再按点位或槽位取整
      const u=((ev.clientX-r.left)/r.width*CW - CP)/(CW-2*CP);
      let i=tip.band? Math.floor(u*n) : Math.round(u*(n-1));
      i=Math.max(0, Math.min(n-1, i));
      const x=(tip.band? xBand(i,n) : xAt(i,n))/CW*r.width;
      cur.style.left=x.toFixed(1)+'px'; cur.style.display='block';
      el.innerHTML='<div class="dt">'+esc(tip.dates[i])+'</div>'+tip.series.map(function(s){
        const v=s.values? s.values[i] : null;
        return '<div class="r"><span class="dot" style="background:'+s.color+'"></span>'+
          esc(s.name||'')+'<b>'+(v==null?'—':fmt(v))+'</b></div>';
      }).join('');
      el.style.display='block';
      // 贴着竖线放,但不许越出图框 —— 越出去的那半截会被卡片裁掉,读不到数
      el.style.left=Math.max(0, Math.min(r.width-el.offsetWidth, x+12)).toFixed(1)+'px';
    });
    box.addEventListener('mouseleave', function(){
      cur.style.display='none'; el.style.display='none';
    });
  });
}

// 折叠状态不记忆,刷新回到收起 —— 这页的立场是「看完就关」,不该帮人把长尾摊着。
function toggleRank(btn){
  const card=btn.closest('.card'), open=card.classList.toggle('open');
  btn.textContent = open? '收起 ▴' : '展开剩余 '+btn.dataset.n+' 条 ▾';
  // 在第 100 行点「收起」时,表一下子缩掉一百多行,滚动位置原地不动 = 人被甩到卡片下面
  // 的空白里。收起后把这张卡拉回视野,点完还站在原地。
  if(!open) card.scrollIntoView({block:'nearest'});
}
function kpi(n,l,hint){
  return '<div class="card kpi"><div class="n">'+n+'</div><div class="l">'+l+'</div>'+
    (hint?'<div class="h">'+hint+'</div>':'')+'</div>';
}
load();
</script>
</body></html>`
