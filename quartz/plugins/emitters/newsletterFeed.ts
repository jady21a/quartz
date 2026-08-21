import { Root, Element, ElementContent, Parent } from "hast"
import { GlobalConfiguration } from "../../cfg"
import { escapeHTML } from "../../util/escape"
import { FullSlug, SimpleSlug, joinSegments, simplifySlug } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { toHtml } from "hast-util-to-html"
import { write } from "./helpers"
import { noteTimestamp } from "../../util/noteCreated"
import { isBookStub } from "../transformers/noteSubstance"

// 给邮件通讯(newsletter)用的**全文** feed,输出 /newsletter.xml。
//
// 为什么不直接把现有的 /index.xml 开成全文:
//   1. index.xml 是给 RSS 阅读器的,摘要版体积小、抓取频繁,不想改它的语义;
//   2. 更要命的是**相对路径**。ContentIndex 开 rssFullHtml 后是把页面 hast 原样序列化,
//      而构建产物里的图片是 `../tech-notes/snap/xxx.png` 这种相对写法 —— 丢进邮件客户端
//      没有「当前页面」这个基准,图片全裂、内链全死。
// 所以这里单独出一份:全文 + 把所有 src/href/srcset 按各自页面 URL 解析成绝对地址。
//
// 消费方是 workers/newsletter 的定时 Worker(拉这个 feed 做差分 → 渲染邮件 → 群发)。
// 它同时也是一份合格的全文 RSS,想订全文的读者可以直接用。

interface Options {
  // 输出文件名(不含 .xml),默认 newsletter → /newsletter.xml
  slug: string
  // 最多保留多少条。比 index.xml 宽松些:Worker 万一停了几天,回来还能补上
  limit: number
  // 与 ContentIndex 的 RSS 排除规则保持一致(按 slug 前缀 / 精确 slug)
  excludeFolders: string[]
  excludeSlugs: string[]
}

const defaultOptions: Options = {
  slug: "newsletter",
  limit: 20,
  excludeFolders: [],
  excludeSlugs: [],
}

// 这些标签在邮件里没有意义,而且 <script> 进 feed 纯属有害,序列化前直接摘掉
const DROP_TAGS = new Set(["script", "style", "noscript", "template"])

// 不需要(也不能)改写的链接形态
function isAbsoluteish(url: string): boolean {
  return (
    url.startsWith("#") ||
    url.startsWith("data:") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(url)
  )
}

function absolutizeUrl(url: string, pageUrl: string): string {
  if (!url || isAbsoluteish(url)) return url
  try {
    return new URL(url, pageUrl).href
  } catch {
    return url
  }
}

// srcset 是 "url 1x, url 2x" 形式,得逐段改写
function absolutizeSrcset(value: string, pageUrl: string): string {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim()
      if (!trimmed) return trimmed
      const spaceIdx = trimmed.search(/\s/)
      if (spaceIdx === -1) return absolutizeUrl(trimmed, pageUrl)
      const url = trimmed.slice(0, spaceIdx)
      const descriptor = trimmed.slice(spaceIdx)
      return absolutizeUrl(url, pageUrl) + descriptor
    })
    .filter(Boolean)
    .join(", ")
}

const URL_PROPS = ["href", "src", "poster"] as const

// 返回一棵新树 —— 绝不原地改。这个 tree 是 ContentPage 等其他 emitter 共用的,
// 就地改写 src 会把整站页面的相对路径也改掉。
function rewriteTree<T extends Parent>(node: T, pageUrl: string): T {
  const children: ElementContent[] = []
  for (const child of node.children as ElementContent[]) {
    if (child.type === "element") {
      if (DROP_TAGS.has(child.tagName)) continue
      const el = child as Element
      const properties = { ...el.properties }
      for (const prop of URL_PROPS) {
        const value = properties[prop]
        if (typeof value === "string") {
          properties[prop] = absolutizeUrl(value, pageUrl)
        }
      }
      if (typeof properties.srcSet === "string") {
        properties.srcSet = absolutizeSrcset(properties.srcSet, pageUrl)
      }
      children.push({ ...rewriteTree({ ...el, properties }, pageUrl) })
    } else {
      children.push(child)
    }
  }
  return { ...node, children } as T
}

type Entry = {
  slug: SimpleSlug
  title: string
  html: string
  date: Date
  description: string
}

function generateFeed(cfg: GlobalConfiguration, entries: Entry[]): string {
  const base = cfg.baseUrl ?? ""
  const items = entries
    .map((entry) => {
      const url = `https://${joinSegments(base, encodeURI(entry.slug))}`
      return `<item>
      <title>${escapeHTML(entry.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description><![CDATA[${entry.description}]]></description>
      <content:encoded><![CDATA[${entry.html}]]></content:encoded>
      <pubDate>${entry.date.toUTCString()}</pubDate>
    </item>`
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeHTML(cfg.pageTitle)}</title>
    <link>https://${base}</link>
    <description>${escapeHTML(cfg.pageTitle)} 全文订阅(邮件通讯用)</description>
    <language>${cfg.locale ?? "zh-CN"}</language>
    <generator>Quartz NewsletterFeed</generator>
${items}
  </channel>
</rss>`
}

export const NewsletterFeed: QuartzEmitterPlugin<Partial<Options>> = (userOpts) => {
  const opts: Options = { ...defaultOptions, ...userOpts }
  return {
    name: "NewsletterFeed",
    async *emit(ctx, content) {
      const cfg = ctx.cfg.configuration
      const base = cfg.baseUrl ?? ""
      const entries: Entry[] = []

      for (const [tree, file] of content) {
        const slug = file.data.slug!
        if (!file.data.text) continue
        // index 页(含首页/文件夹页)不是文章,不进邮件
        if (slug.endsWith("index")) continue
        if (opts.excludeSlugs.includes(slug)) continue
        if (opts.excludeFolders.some((prefix) => slug.startsWith(prefix))) continue
        // 刚加进来、Overview 还空着也没写读书笔记的书:只有一副模板骨架,不该群发给订阅者。
        // 等笔记写起来了它才会进 feed —— 那时才算一篇真内容(与侧栏「最新」同一口径)
        if (isBookStub(file.data)) continue

        // 用创建时间,与 index.xml 同口径:改一下旧文不该重新顶上来、更不该重发邮件
        const createdTs = noteTimestamp({
          frontmatter: file.data.frontmatter,
          relativePath: file.data.relativePath,
        })
        if (!createdTs) continue

        const simple = simplifySlug(slug)
        const pageUrl = `https://${joinSegments(base, encodeURI(simple))}`
        const rewritten = rewriteTree(tree as Root, pageUrl)

        entries.push({
          slug: simple,
          title: file.data.frontmatter?.title ?? simple,
          html: toHtml(rewritten, { allowDangerousHtml: true }),
          date: new Date(createdTs),
          description: file.data.description ?? "",
        })
      }

      entries.sort((a, b) => b.date.getTime() - a.date.getTime())

      yield write({
        ctx,
        content: generateFeed(cfg, entries.slice(0, opts.limit)),
        slug: opts.slug as FullSlug,
        ext: ".xml",
      })
    },
  }
}
