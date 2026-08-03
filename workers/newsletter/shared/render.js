// 邮件正文渲染:把 newsletter.xml 里的文章 HTML 变成能在邮件客户端里活下来的 HTML,
// 外加一份纯文本版(没有纯文本版会显著拉高垃圾邮件评分)。
//
// 邮件 HTML 的现实约束,决定了下面这些看起来倒退的写法:
//   - 布局用 <table>,不用 flex/grid(Outlook 走 Word 渲染引擎,后者根本不支持)
//   - 结构性样式(宽度/内边距/背景)必须**内联**;<style> 块只放锦上添花的排版,
//     被剥掉也不影响可读性
//   - <svg> 一律删:Gmail 直接剥掉,留着只会在别处显示成破图
//   - 代码块用 white-space:pre-wrap —— 邮件里没有横向滚动容器,不折行就会把整个
//     布局撑破、手机上全是横向滚动条

const SITE_NAME = "Why Z"
const SITE_URL = "https://jz21.eu.org"

const TEXT = {
  zh: {
    readOnline: "在网页上阅读",
    why: `你收到这封邮件,是因为你订阅了 ${SITE_NAME}。`,
    unsubscribe: "退订",
    confirmSubject: `确认订阅 ${SITE_NAME}`,
    confirmHeading: "还差一步",
    confirmBody: `点下面的按钮确认订阅,以后有新文章我会直接发到这个邮箱。<br>如果不是你本人操作,忽略这封邮件即可,不会有任何后续。`,
    confirmButton: "确认订阅",
    confirmFallback: "按钮点不动的话,把这个链接复制到浏览器打开:",
  },
  en: {
    readOnline: "Read online",
    why: `You're receiving this because you subscribed to ${SITE_NAME}.`,
    unsubscribe: "Unsubscribe",
    confirmSubject: `Confirm your subscription to ${SITE_NAME}`,
    confirmHeading: "One more step",
    confirmBody: `Click the button below to confirm. New posts will then land in this inbox.<br>If this wasn't you, just ignore this email — nothing else will happen.`,
    confirmButton: "Confirm subscription",
    confirmFallback: "If the button doesn't work, paste this link into your browser:",
  },
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** 把文章 HTML 收拾成邮件客户端能吃的形态 */
export function sanitizeForEmail(html) {
  return (
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      // 标题锚点图标、callout 图标等,Gmail 会剥掉 svg,留着是负担
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
      // 代码块的「复制」按钮在邮件里点不了
      .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, "")
      // 任务列表的 checkbox:邮件客户端普遍剥掉 <input>,换成符号才看得见
      .replace(/<input\b[^>]*type=["']?checkbox["']?[^>]*checked[^>]*>/gi, "☑ ")
      .replace(/<input\b[^>]*type=["']?checkbox["']?[^>]*>/gi, "☐ ")
      // 图片必须限宽,否则手机上撑破布局
      .replace(/<img\b/gi, '<img style="max-width:100%;height:auto;border:0;display:block;" ')
  )
}

const BLOCK_TAGS =
  /<\/?(p|div|h[1-6]|ul|ol|blockquote|pre|section|article|figure|figcaption|table|tr|hr|br)\b[^>]*>/gi

/** 纯文本版。不追求还原排版,只要能读、能看到链接 */
export function htmlToText(html) {
  let out = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    // 链接保留地址,否则纯文本读者丢失全部引用
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
      const label = inner.replace(/<[^>]+>/g, "").trim()
      if (!label) return ""
      if (href.startsWith("#")) return label
      return `${label} (${href})`
    })
    .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi, (_m, alt) =>
      alt ? `[图片:${alt}]` : "[图片]",
    )
    .replace(/<img\b[^>]*>/gi, "[图片]")
    .replace(BLOCK_TAGS, "\n")
    .replace(/<[^>]+>/g, "")

  out = out
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")

  return out
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// 所有邮件共用的外壳。content 是已经处理好的 HTML 片段。
function shell({ title, preheader, contentHtml, footerHtml }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  /* 会被部分客户端剥掉 —— 这里只放"没有也能读"的排版,结构样式一律内联 */
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  .wz-content { font-size:16px; line-height:1.75; color:#2b2b2b; }
  .wz-content h2 { font-size:20px; line-height:1.4; margin:32px 0 12px; font-weight:600; }
  .wz-content h3 { font-size:17px; line-height:1.4; margin:24px 0 10px; font-weight:600; }
  .wz-content p { margin:0 0 16px; }
  .wz-content a { color:#284b63; }
  .wz-content ul, .wz-content ol { margin:0 0 16px; padding-left:22px; }
  .wz-content li { margin:0 0 6px; }
  .wz-content blockquote { margin:0 0 16px; padding:12px 16px; border-left:3px solid #84a59d;
    background:#f3f5f5; border-radius:0 4px 4px 0; }
  .wz-content blockquote p:last-child { margin-bottom:0; }
  .wz-content code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px;
    background:#f0f0f0; padding:1px 4px; border-radius:3px; }
  /* 邮件里没有横向滚动容器,代码块不折行就会撑破布局 */
  .wz-content pre { background:#f6f6f6; padding:12px 14px; border-radius:6px; overflow:auto;
    white-space:pre-wrap; word-break:break-word; margin:0 0 16px; }
  .wz-content pre code { background:none; padding:0; font-size:12.5px; line-height:1.6; }
  .wz-content img { max-width:100%; height:auto; border-radius:4px; margin:8px 0; }
  .wz-content figure { margin:16px 0; }
  .wz-content figcaption { font-size:13px; color:#7b7b7b; margin-top:6px; }
  .wz-content hr { border:0; border-top:1px solid #e5e5e5; margin:28px 0; }
  .wz-content table { border-collapse:collapse; width:100%; font-size:14px; }
  .wz-content th, .wz-content td { border:1px solid #e5e5e5; padding:6px 10px; text-align:left; }
  @media (prefers-color-scheme: dark) {
    .wz-body { background:#22272e !important; }
    .wz-card { background:#2e3440 !important; }
    .wz-content, .wz-content h2, .wz-content h3 { color:#eceff4 !important; }
    .wz-content a { color:#81a1c1 !important; }
    .wz-content blockquote { background:#3b4252 !important; }
    .wz-content code, .wz-content pre { background:#3b4252 !important; color:#eceff4 !important; }
    .wz-muted { color:#9aa5b1 !important; }
  }
</style>
</head>
<body class="wz-body" style="margin:0;padding:0;background:#faf8f8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf8f8;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"
             class="wz-card" style="width:100%;max-width:640px;background:#ffffff;border-radius:8px;">
        <tr>
          <td style="padding:28px 32px 0;">
            <a href="${SITE_URL}" style="color:#84a59d;text-decoration:none;font-size:13px;
               letter-spacing:.08em;text-transform:uppercase;">${SITE_NAME}</a>
          </td>
        </tr>
        <tr>
          <td class="wz-content" style="padding:16px 32px 24px;font-family:-apple-system,BlinkMacSystemFont,
              'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
              font-size:16px;line-height:1.75;color:#2b2b2b;">
${contentHtml}
          </td>
        </tr>
        <tr>
          <td class="wz-muted" style="padding:20px 32px 28px;border-top:1px solid #e5e5e5;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;
              font-size:12px;line-height:1.7;color:#8a8a8a;">
${footerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

/** 新文章推送 */
export function renderIssue({ entry, unsubscribeUrl, lang = "zh" }) {
  const t = TEXT[lang] ?? TEXT.zh
  const body = sanitizeForEmail(entry.content)
  const date = entry.pubDate ? new Date(entry.pubDate) : null
  const dateLabel = date
    ? date.toLocaleDateString(lang === "en" ? "en-US" : "zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Shanghai",
      })
    : ""

  const contentHtml = `
<h1 style="margin:0 0 6px;font-size:26px;line-height:1.35;font-weight:600;color:#2b2b2b;">
  <a href="${escapeHtml(entry.link)}" style="color:inherit;text-decoration:none;">${escapeHtml(entry.title)}</a>
</h1>
<p class="wz-muted" style="margin:0 0 24px;font-size:13px;color:#8a8a8a;">${escapeHtml(dateLabel)}</p>
${body}
<p style="margin:32px 0 0;">
  <a href="${escapeHtml(entry.link)}" style="color:#284b63;">${t.readOnline} →</a>
</p>`

  const footerHtml = `
${escapeHtml(t.why)}<br>
<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a8a8a;text-decoration:underline;">${t.unsubscribe}</a>
&nbsp;·&nbsp;
<a href="${SITE_URL}" style="color:#8a8a8a;text-decoration:underline;">${SITE_NAME}</a>`

  const text = [
    entry.title,
    dateLabel,
    "",
    htmlToText(entry.content),
    "",
    "—",
    `${t.readOnline}: ${entry.link}`,
    t.why,
    `${t.unsubscribe}: ${unsubscribeUrl}`,
  ].join("\n")

  return {
    subject: entry.title,
    html: shell({
      title: entry.title,
      preheader: entry.description || entry.title,
      contentHtml,
      footerHtml,
    }),
    text,
  }
}

/** 双重确认(double opt-in)邮件 */
export function renderConfirm({ confirmUrl, lang = "zh" }) {
  const t = TEXT[lang] ?? TEXT.zh

  const contentHtml = `
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.35;font-weight:600;color:#2b2b2b;">${t.confirmHeading}</h1>
<p style="margin:0 0 24px;">${t.confirmBody}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td align="center" bgcolor="#284b63" style="border-radius:6px;">
      <a href="${escapeHtml(confirmUrl)}"
         style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;
                font-size:15px;font-weight:600;border-radius:6px;">${t.confirmButton}</a>
    </td>
  </tr>
</table>
<p class="wz-muted" style="margin:0;font-size:13px;color:#8a8a8a;">${t.confirmFallback}<br>
  <a href="${escapeHtml(confirmUrl)}" style="color:#8a8a8a;word-break:break-all;">${escapeHtml(confirmUrl)}</a>
</p>`

  const text = [t.confirmHeading, "", t.confirmBody.replace(/<br>/g, "\n"), "", confirmUrl].join(
    "\n",
  )

  return {
    subject: t.confirmSubject,
    html: shell({
      title: t.confirmSubject,
      preheader: t.confirmHeading,
      contentHtml,
      footerHtml: `${SITE_NAME} · <a href="${SITE_URL}" style="color:#8a8a8a;">${SITE_URL}</a>`,
    }),
    text,
  }
}

export { SITE_NAME, SITE_URL }
