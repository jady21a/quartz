// 确认订阅 / 退订的落地页。
//
// 这两个页面是从**邮件客户端**点进来的,不走站点的 SPA,也拿不到 Quartz 的样式表,
// 所以整页自带样式、不依赖站点任何资源。配色跟站点主题保持一致(见 quartz.config.ts)。

const SITE_URL = "https://jz21.eu.org"

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * @param {{title:string, message:string, lang?:string, status?:number}} opts
 */
export function resultPage({ title, message, lang = "zh", status = 200 }) {
  const backLabel = lang === "en" ? "Back to the site" : "回到站点"
  const html = `<!doctype html>
<html lang="${lang === "en" ? "en" : "zh-CN"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  :root { --bg:#faf8f8; --card:#fff; --fg:#2b2b2b; --muted:#8a8a8a; --accent:#284b63; --line:#e5e5e5; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#2e3440; --card:#3b4252; --fg:#eceff4; --muted:#9aa5b1; --accent:#81a1c1; --line:#434c5e; }
  }
  * { box-sizing:border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:24px; background:var(--bg); color:var(--fg);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',
      'Microsoft YaHei',sans-serif; line-height:1.7; }
  .card { width:100%; max-width:460px; background:var(--card); border:1px solid var(--line);
    border-radius:10px; padding:36px 32px; }
  .brand { font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--accent);
    text-decoration:none; }
  h1 { margin:14px 0 10px; font-size:22px; line-height:1.35; font-weight:600; }
  p { margin:0 0 18px; color:var(--muted); font-size:15px; }
  a.back { display:inline-block; color:var(--accent); font-size:14px; text-decoration:none;
    border-bottom:1px solid currentColor; padding-bottom:1px; }
</style>
</head>
<body>
  <div class="card">
    <a class="brand" href="${SITE_URL}">Why Z</a>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a class="back" href="${SITE_URL}">${backLabel} →</a>
  </div>
</body>
</html>`
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  })
}
