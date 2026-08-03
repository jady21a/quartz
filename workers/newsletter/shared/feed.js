// newsletter.xml 的解析。
//
// Workers 里没有 DOMParser,也不值得为一个自己生成、格式完全可控的 feed 引一个 XML 库。
// 正则够用 —— 前提是生成端(quartz/plugins/emitters/newsletterFeed.ts)始终把正文放在
// CDATA 里,所以正文里的 < > & 不会干扰这里的标签匹配。

function unwrapCdata(value) {
  const m = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  if (m) return m[1]
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim()
}

function pick(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))
  return m ? unwrapCdata(m[1]) : ""
}

/**
 * @returns {{guid:string,title:string,link:string,description:string,content:string,pubDate:string}[]}
 *          顺序与 feed 一致(新→旧)
 */
export function parseFeed(xml) {
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = re.exec(xml)) !== null) {
    const block = match[1]
    const link = pick(block, "link")
    const guid = pick(block, "guid") || link
    if (!guid) continue
    items.push({
      guid,
      link,
      title: pick(block, "title"),
      description: pick(block, "description"),
      content: pick(block, "content:encoded"),
      pubDate: pick(block, "pubDate"),
    })
  }
  return items
}
