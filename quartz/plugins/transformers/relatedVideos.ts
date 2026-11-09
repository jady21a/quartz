import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { Element, ElementContent, Root } from "hast"
import { QuartzTransformerPlugin } from "../types"
import { FilePath, FullSlug, resolveRelative, slugifyFilePath } from "../../util/path"

// 视频页的「相关视频 / Related videos」行改成双向:A 页写了 B,B 页也自动列出 A。
// 只需在新视频页写一次,老视频页不用回头改。做法同 ReadStubLinks:开工前把视频页源文件
// 扫一遍建关系表(中英文各一张),再把每页那一行按关系表重写;没写这一行但被别人链到的页,
// 在开头一节末尾(第二个 h2 之前)补一行。草稿页不出现。

const VIDEO_DIRS = ["7.shared/视频Meta", "en/7.shared/视频Meta"]
const LINE = /^(相关视频|Related videos)\s*[:：]/
const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g

interface VideoPage {
  slug: FullSlug
  title: string
  draft: boolean
  links: Map<string, string | undefined> // 目标文件名(不含扩展名) → 自己写的别名
}

type Graph = Map<FullSlug, { related: Set<FullSlug>; aliases: Map<FullSlug, string> }>

function buildGraphs(contentDir: string): { graph: Graph; pages: Map<FullSlug, VideoPage> } {
  const graph: Graph = new Map()
  const pages = new Map<FullSlug, VideoPage>()
  const keepDrafts = process.env.QUARTZ_KEEP_DRAFTS === "1"

  for (const dir of VIDEO_DIRS) {
    let names: string[]
    try {
      names = fs.readdirSync(path.join(contentDir, dir)).filter((n) => n.endsWith(".md"))
    } catch {
      continue
    }
    const byStem = new Map<string, VideoPage>()
    for (const name of names) {
      const src = fs.readFileSync(path.join(contentDir, dir, name), "utf-8")
      let fm: Record<string, any> = {}
      try {
        fm = matter(src).data
      } catch {}
      const links = new Map<string, string | undefined>()
      const line = src.split("\n").find((l) => LINE.test(l.trim()))
      if (line) {
        for (const m of line.matchAll(WIKILINK)) {
          links.set(m[1].trim().split("/").pop()!, m[2]?.trim())
        }
      }
      const title = Array.isArray(fm.title) ? fm.title[0] : fm.title
      const page: VideoPage = {
        slug: slugifyFilePath(`${dir}/${name}` as FilePath),
        title: String(title ?? name.replace(/\.md$/, "")),
        draft: !keepDrafts && (fm.draft === true || fm.draft === "true"),
        links,
      }
      byStem.set(name.replace(/\.md$/, ""), page)
      pages.set(page.slug, page)
    }

    const node = (s: FullSlug) => {
      if (!graph.has(s)) graph.set(s, { related: new Set(), aliases: new Map() })
      return graph.get(s)!
    }
    for (const page of byStem.values()) {
      for (const [stem, alias] of page.links) {
        const target = byStem.get(stem)
        if (!target || target.slug === page.slug) continue
        node(page.slug).related.add(target.slug)
        node(target.slug).related.add(page.slug)
        if (alias) node(page.slug).aliases.set(target.slug, alias)
      }
    }
  }
  return { graph, pages }
}

function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type === "element") return node.children.map(textOf).join("")
  return ""
}

// 段落里的软换行是文本节点里的 "\n";按它把子节点切成一行一组
function splitLines(children: ElementContent[]): ElementContent[][] {
  const lines: ElementContent[][] = [[]]
  for (const c of children) {
    if (c.type === "text" && c.value.includes("\n")) {
      const parts = c.value.split("\n")
      parts.forEach((part, j) => {
        if (j > 0) lines.push([])
        if (part) lines[lines.length - 1].push({ type: "text", value: part })
      })
    } else if (c.type === "element" && c.tagName === "br") {
      lines.push([])
    } else {
      lines[lines.length - 1].push(c)
    }
  }
  return lines
}

function joinLines(lines: ElementContent[][]): ElementContent[] {
  return lines.flatMap((l, i) => (i > 0 ? [{ type: "text", value: "\n" } as ElementContent, ...l] : l))
}

export const RelatedVideos: QuartzTransformerPlugin = () => ({
  name: "RelatedVideos",
  htmlPlugins(ctx) {
    const { graph, pages } = buildGraphs(ctx.argv.directory)
    return [
      () => (tree: Root, file) => {
        const slug = file.data.slug!
        const entry = graph.get(slug)
        if (!entry) return
        const isEn = slug.startsWith("en/")
        const targets = [...entry.related]
          .map((s) => pages.get(s)!)
          .filter((p) => p && !p.draft)
          .sort((a, b) => a.slug.localeCompare(b.slug))

        const children: ElementContent[] = [
          { type: "text", value: isEn ? "Related videos: " : "相关视频:" },
        ]
        targets.forEach((t, i) => {
          if (i > 0) children.push({ type: "text", value: isEn ? " · " : "、" })
          children.push({
            type: "element",
            tagName: "a",
            properties: {
              href: resolveRelative(slug, t.slug),
              className: ["internal", "alias"],
              "data-slug": t.slug,
            },
            children: [{ type: "text", value: entry.aliases.get(t.slug) ?? t.title }],
          })
        })
        const para: Element = { type: "element", tagName: "p", properties: {}, children }

        // 「相关视频」常和「相关代码」连写成同一段,按行拆开,只换掉那一行
        const nodes = tree.children
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i]
          if (n.type !== "element" || n.tagName !== "p") continue
          const lines = splitLines(n.children)
          const at = lines.findIndex((l) => LINE.test(l.map(textOf).join("").trim()))
          if (at < 0) continue
          lines.splice(at, 1)
          const rest = lines.filter((l) => l.map(textOf).join("").trim() !== "")
          const replacement: Root["children"] = []
          if (rest.length > 0) {
            replacement.push({ ...n, children: joinLines(rest) }, { type: "text", value: "\n" })
          }
          if (targets.length > 0) replacement.push(para)
          nodes.splice(i, 1, ...replacement)
          return
        }
        if (targets.length === 0) return
        // 插在开头一节末尾:第一个 h2 之后的下一个 h2/h3 前;后面没有标题就放页尾
        const isHeading = (n: Root["children"][number], tags: string[]) =>
          n.type === "element" && tags.includes(n.tagName)
        const first = nodes.findIndex((n) => isHeading(n, ["h2"]))
        const next = nodes.findIndex((n, i) => i > first && isHeading(n, ["h2", "h3"]))
        const at = first >= 0 && next >= 0 ? next : nodes.length
        nodes.splice(at, 0, para, { type: "text", value: "\n" })
      },
    ]
  },
})
