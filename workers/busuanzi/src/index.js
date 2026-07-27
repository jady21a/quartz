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

  return new Response(
    JSON.stringify({
      generatedAt: new Date().toISOString(),
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
    return new Response(JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    })
  }
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
  a{color:var(--acc);text-decoration:none}
  a:hover{text-decoration:underline}
  .bar{height:6px;border-radius:3px;background:var(--acc);opacity:.85}
  .two{grid-template-columns:1fr 1fr}
  @media(max-width:720px){.two{grid-template-columns:1fr}.path{max-width:60vw}}
  .muted{color:var(--mut)}
  .note{font-size:12.5px;color:var(--warn);background:rgba(224,175,104,.08);
    border:1px solid rgba(224,175,104,.3);border-radius:10px;padding:10px 12px;margin-bottom:14px}
  .chart{width:100%;height:150px;display:block}
  .legend{display:flex;gap:14px;font-size:12px;color:var(--mut);margin-top:6px}
  .dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:middle}
  button.refresh{background:var(--card);color:var(--fg);border:1px solid var(--line);
    border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer}
  button.refresh:hover{border-color:var(--acc)}
  .err{color:#f7768e}
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

function lineChart(series, colors, labels){
  // series: array of {values:[...]} aligned to same x; simple SVG line chart
  const W=680,H=150,P=24, n=series[0].values.length;
  if(n===0) return '<div class="muted">暂无数据</div>';
  let max=0; series.forEach(s=>s.values.forEach(v=>{if(v>max)max=v}));
  max=max||1;
  const x=i=> P + (n===1? (W-2*P)/2 : i*(W-2*P)/(n-1));
  const y=v=> H-P - v/max*(H-2*P);
  let paths='';
  series.forEach((s,si)=>{
    const d=s.values.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
    paths+='<path d="'+d+'" fill="none" stroke="'+colors[si]+'" stroke-width="2" stroke-linejoin="round"/>';
    if(n===1) paths+='<circle cx="'+x(0)+'" cy="'+y(s.values[0])+'" r="3" fill="'+colors[si]+'"/>';
  });
  // x labels: first & last
  const lab='<text x="'+P+'" y="'+(H-4)+'" fill="var(--mut)" font-size="10">'+labels[0]+'</text>'+
    '<text x="'+(W-P)+'" y="'+(H-4)+'" fill="var(--mut)" font-size="10" text-anchor="end">'+labels[n-1]+'</text>'+
    '<text x="2" y="12" fill="var(--mut)" font-size="10">'+fmt(max)+'</text>';
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+paths+lab+'</svg>';
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
    h+=kpi(fmt(cf.totals.pageViews),'边缘页面浏览 30d','Cloudflare · 含爬虫');
    h+=kpi(fmt(cf.totals.requests),'边缘请求 30d','Cloudflare · 含爬虫');
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
      [{values:bd.map(x=>x.pv)},{values:bd.map(x=>x.uv)}],
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
      [{values:cfd.map(x=>x.requests||0)},{values:cfd.map(x=>x.pageViews||0)},{values:cfd.map(x=>x.uniques||0)}],
      ['var(--acc)','var(--warn)','var(--acc2)'],
      cfd.map(x=>x.date.slice(5)));
    h+='<div class="legend"><span><span class="dot" style="background:var(--acc)"></span>请求</span>'+
       '<span><span class="dot" style="background:var(--warn)"></span>页面浏览</span>'+
       '<span><span class="dot" style="background:var(--acc2)"></span>独立 IP</span></div>';
  } else h+='<div class="muted">未接入 CF,或定时快照尚未开始累积。</div>';
  h+='</div>';
  h+='</div>';

  // 每页 PV 排行
  h+='<div class="card" style="margin-bottom:14px"><h2>页面 PV 排行(busuanzi)</h2>';
  if(d.pages.length){
    const max=d.pages[0].pv||1;
    h+='<table><thead><tr><th>页面</th><th></th><th class="num">PV</th></tr></thead><tbody>';
    h+=d.pages.slice(0,50).map(p=>{
      const url='https://jz21.eu.org'+(p.path==='/'?'':p.path);
      return '<tr><td class="path"><a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(p.path)+'</a></td>'+
        '<td style="width:35%"><div class="bar" style="width:'+Math.max(4,p.pv/max*100).toFixed(1)+'%"></div></td>'+
        '<td class="num">'+fmt(p.pv)+'</td></tr>';
    }).join('');
    h+='</tbody></table>';
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
}
function kpi(n,l,hint){
  return '<div class="card kpi"><div class="n">'+n+'</div><div class="l">'+l+'</div>'+
    (hint?'<div class="h">'+hint+'</div>':'')+'</div>';
}
load();
</script>
</body></html>`
