import { Element, ElementContent, Root } from "hast"
import { QuartzTransformerPlugin } from "../types"
import { FullSlug } from "../../util/path"

// 视频发布后的改进只记在一处:frontmatter 带 `updatesHub: true` 的专题页(专题 001)的
// 「后续优化 / Future improvements」列表。这里把那张列表拆成条目存进 file.data,
// 每条记下它链到了哪些页面(CrawlLinks 写好的 data-slug);视频页底部的 VideoUpdates 组件
// 再按「链到了我」筛出本期的那几条。一条改进涉及几期视频,就在条目里链上几期。
// 一条改进如果在第一句下面还缩进写了代码、步骤等,那部分收进「展开详情」折叠块,
// 专题页和视频页都一样能当场展开,不用跳页;「相关」链接只从第一句里取。
// 专题页上只直接显示最近 RECENT 条,更早的收进「更早的改进」折叠块,免得把全景图挤到下面。
// 必须放在 CrawlLinks 之后。

export interface VideoUpdateEntry {
  slugs: FullSlug[]
  node: Element
}

const HEADINGS = ["后续优化", "Future improvements"]
const RECENT = 5
const BLOCKS = new Set(["p", "pre", "ul", "ol", "blockquote", "div", "figure", "table", "details", "h3", "h4", "h5", "h6"])

const isBlank = (n: ElementContent) => n.type === "text" && n.value.trim() === ""

// 拆成「第一句」和「详情」,有详情就把它包进 <details>(原地改,专题页本身也折叠)
function foldDetails(li: Element, label: string): ElementContent[] {
  const kids = li.children
  let summary: ElementContent[]
  let rest: ElementContent[]
  const first = kids.find((k) => !isBlank(k))
  if (first?.type === "element" && first.tagName === "p") {
    const i = kids.indexOf(first)
    summary = [first]
    rest = kids.slice(i + 1)
  } else {
    const cut = kids.findIndex((k) => k.type === "element" && BLOCKS.has(k.tagName))
    summary = cut < 0 ? kids : kids.slice(0, cut)
    rest = cut < 0 ? [] : kids.slice(cut)
  }
  if (rest.some((k) => !isBlank(k))) {
    li.children = [
      ...summary,
      {
        type: "element",
        tagName: "details",
        properties: { className: ["update-details"] },
        children: [
          { type: "element", tagName: "summary", properties: {}, children: [{ type: "text", value: label }] },
          ...rest,
        ],
      },
    ]
  }
  return summary
}

// 「相关:」后面的视频链接直接跳到那一期视频页底部的这一条;作者自己写了 # 锚点的照旧
const RELATED = /(相关|Related)\s*[:：]/
function pointToEntry(li: Element, id: string) {
  const first = li.children.find((k) => !isBlank(k))
  const inline = first?.type === "element" && first.tagName === "p" ? first.children : li.children
  let after = false
  for (const n of inline) {
    if (n.type === "text" && RELATED.test(n.value)) after = true
    if (!after || n.type !== "element" || n.tagName !== "a") continue
    const href = String(n.properties?.href ?? "")
    if (n.properties?.["data-slug"] && !href.includes("#")) n.properties.href = `${href}#${id}`
  }
}

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type === "element") return node.children.map(textOf).join("")
  return ""
}

export const VideoUpdates: QuartzTransformerPlugin = () => ({
  name: "VideoUpdates",
  htmlPlugins() {
    return [
      () => (tree: Root, file) => {
        if (file.data.frontmatter?.updatesHub !== true) return
        const nodes = tree.children
        const h = nodes.findIndex(
          (n) =>
            n.type === "element" &&
            n.tagName === "h2" &&
            HEADINGS.includes(textOf(n).trim()),
        )
        if (h < 0) return
        const list = nodes
          .slice(h + 1)
          .find((n): n is Element => n.type === "element" && n.tagName !== "p")
        if (!list || list.tagName !== "ul") return

        const isEn = (file.data.slug ?? "").startsWith("en/")
        const entries: VideoUpdateEntry[] = []
        const total = list.children.filter((n) => n.type === "element" && n.tagName === "li").length
        for (const li of list.children) {
          if (li.type !== "element" || li.tagName !== "li") continue
          // 编号从最旧的一条数起,新条目加在最上面也不会让旧条目的编号变
          const id = `update-${total - entries.length}`
          pointToEntry(li, id)
          const summary = foldDetails(li, isEn ? "Details" : "展开详情")
          const slugs = new Set<FullSlug>()
          const walk = (n: ElementContent) => {
            if (n.type !== "element") return
            const s = n.properties?.["data-slug"]
            if (n.tagName === "a" && typeof s === "string") slugs.add(s as FullSlug)
            n.children.forEach(walk)
          }
          summary.forEach(walk)
          const node = structuredClone(li)
          node.properties = { ...node.properties, id }
          entries.push({ slugs: [...slugs], node })
        }
        file.data.videoUpdates = entries

        // 拆好条目之后再折叠专题页本身,视频页拿到的仍是全部条目
        const items = list.children.filter((n) => n.type === "element" && n.tagName === "li")
        if (items.length > RECENT) {
          const older = items.slice(RECENT)
          list.children = items.slice(0, RECENT)
          const label = isEn ? `Earlier improvements (${older.length})` : `更早的改进(${older.length} 条)`
          nodes.splice(nodes.indexOf(list) + 1, 0, {
            type: "element",
            tagName: "details",
            properties: { className: ["update-older"] },
            children: [
              { type: "element", tagName: "summary", properties: {}, children: [{ type: "text", value: label }] },
              { type: "element", tagName: "ul", properties: {}, children: older },
            ],
          })
        }
        file.data.videoUpdatesAnchor = (nodes[h] as Element).properties?.id as string | undefined
      },
    ]
  },
})

declare module "vfile" {
  interface DataMap {
    videoUpdates: VideoUpdateEntry[]
    videoUpdatesAnchor: string
  }
}
