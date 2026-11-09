import { Element, ElementContent } from "hast"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { htmlToJsx } from "../util/jsx"
import { FullSlug, resolveRelative } from "../util/path"
import { classNames } from "../util/lang"
import style from "./styles/videoUpdates.scss"

// 视频页底部「后续优化」:从专题 001 的后续优化列表(transformers/videoUpdates.ts 拆好的条目)
// 里挑出链到本页的那几条显示。改进只在专题 001 写一处,这里自动跟着变;没有条目就什么都不出。

// 条目里的链接是相对专题页写的,搬到视频页要按本页重算;锚点(#后续优化 之类)原样保留。
function rehome(node: ElementContent, current: FullSlug): ElementContent {
  if (node.type !== "element") return node
  const props = { ...node.properties }
  const target = props["data-slug"]
  if (node.tagName === "a" && typeof target === "string") {
    const href = String(props.href ?? "")
    const anchor = href.includes("#") ? href.slice(href.indexOf("#")) : ""
    props.href =
      target === current && anchor ? anchor : resolveRelative(current, target as FullSlug) + anchor
  }
  return { ...node, properties: props, children: node.children.map((c) => rehome(c, current)) }
}

// 视频页的读者已经在这一期上,条目要换成「这一期」的口吻:
// 去掉开头日期后的环节名(「2026-11-09 · 首页」→「2026-11-09」),
// 「相关:」里去掉指向本页的链接、剩下的改叫「也涉及:」,详情默认展开。
const RELATED = /(相关|Related)\s*[:：]\s*/
const SEPARATOR = /^[\s、,，]*$/

function forEpisode(children: ElementContent[], current: FullSlug, isEn: boolean): ElementContent[] {
  const out = [...children]
  const lead = out.findIndex((n) => n.type === "element")
  const strong = out[lead]
  if (strong?.type === "element" && strong.tagName === "strong") {
    const text = strong.children.map((c) => (c.type === "text" ? c.value : "")).join("")
    const date = text.split(" · ")[0]
    if (date !== text) out[lead] = { ...strong, children: [{ type: "text", value: date }] }
  }

  const i = out.findIndex((n) => n.type === "text" && RELATED.test(n.value))
  if (i < 0) return out
  const marker = out[i] as { type: "text"; value: string }
  const before = marker.value.slice(0, marker.value.search(RELATED))
  const after = marker.value.replace(/^.*?(相关|Related)\s*[:：]\s*/s, "")
  const tail = [...(after ? [{ type: "text", value: after } as ElementContent] : []), ...out.slice(i + 1)]
  const others = tail.filter(
    (n) => n.type === "element" && n.tagName === "a" && n.properties?.["data-slug"] !== current,
  )
  const rest = tail.filter(
    (n) => !(n.type === "element" && n.tagName === "a") && !(n.type === "text" && SEPARATOR.test(n.value)),
  )
  const also: ElementContent[] =
    others.length === 0
      ? []
      : [
          { type: "text", value: isEn ? "Also covers: " : "也涉及:" },
          ...others.flatMap((a, k) =>
            k === 0 ? [a] : [{ type: "text", value: isEn ? ", " : "、" } as ElementContent, a],
          ),
        ]
  return [...out.slice(0, i), { type: "text", value: also.length ? before : before.trimEnd() }, ...also, ...rest]
}

function episodeEntry(li: Element, current: FullSlug, isEn: boolean): Element {
  const first = li.children.find((n) => n.type === "element")
  const children = li.children.map((n) => {
    if (n.type !== "element") return n
    if (n.tagName === "details") return { ...n, properties: { ...n.properties, open: true } }
    if (n === first && n.tagName === "p") return { ...n, children: forEpisode(n.children, current, isEn) }
    return n
  })
  // 紧凑列表没有 <p>,第一句直接是 li 的行内子节点
  if (first?.type === "element" && first.tagName !== "p") {
    const cut = children.findIndex((n) => n.type === "element" && n.tagName === "details")
    const inline = cut < 0 ? children : children.slice(0, cut)
    return { ...li, children: [...forEpisode(inline, current, isEn), ...(cut < 0 ? [] : children.slice(cut))] }
  }
  return { ...li, children }
}

const VideoUpdates: QuartzComponent = ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug!
  const tags: string[] = fileData.frontmatter?.tags ?? []
  if (!tags.includes("video") || fileData.frontmatter?.updatesHub) return null

  const isEn = slug.startsWith("en/")
  const hub = allFiles.find(
    (f) => f.videoUpdates && (f.slug ?? "").startsWith("en/") === isEn,
  )
  const entries = hub?.videoUpdates?.filter((e) => e.slugs.includes(slug)) ?? []
  if (!hub || entries.length === 0) return null

  const list: Element = {
    type: "element",
    tagName: "ul",
    properties: {},
    children: entries.map((e) => episodeEntry(rehome(e.node, slug) as Element, slug, isEn)),
  }
  const hubHref =
    resolveRelative(slug, hub.slug!) + (hub.videoUpdatesAnchor ? "#" + hub.videoUpdatesAnchor : "")

  return (
    <section class={classNames(displayClass, "video-updates")}>
      <h2>{isEn ? "Future improvements" : "后续优化"}</h2>
      {htmlToJsx(fileData.filePath!, list)}
      <p class="video-updates-all">
        <a href={hubHref} class="internal">
          {isEn ? "All improvements across episodes →" : "全部视频的改进汇总 →"}
        </a>
      </p>
    </section>
  )
}

VideoUpdates.css = style

export default (() => VideoUpdates) satisfies QuartzComponentConstructor
