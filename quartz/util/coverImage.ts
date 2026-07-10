/**
 * 详情页封面 URL:外链走 weserv 代理、content 相对路径转根绝对路径。
 * 与 generate-book-index / generate-movies 的 processImagePath 行为对齐,
 * 避免「列表有图、内页无图」。
 * 旧逻辑优先查 scripts/image-mapping.json 按标题映射到 /imgs/旧ID,映射早已
 * 错位导致封面张冠李戴,已连同 /imgs 老图一并移除,这里不再做任何映射改写。
 */
export function resolveCoverUrl(
  raw: unknown,
  _fm: Record<string, unknown>,
  _relativePath: string | undefined,
  _kind: "book" | "movie",
): string {
  if (typeof raw !== "string" || !raw.trim()) return ""

  const url = raw
    .replace(/^\uFEFF/, "")
    .replace(/^\t+/, "")
    .trim()

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`
  }

  // content 相对路径(如 "2.Read/douban/0_dimage/xxx.jpg"):静态资源原样
  // 拷到站点根,必须转成根绝对路径,否则浏览器会相对当前页解析而 404(裂图)。
  const cleaned = url.replace(/^\.\//, "")
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`
}
