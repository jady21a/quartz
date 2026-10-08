import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { Root, Element } from "hast"
import { visit } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"
import { FilePath, FullSlug, slugifyFilePath } from "../../util/path"
import { isReadStub, measureSubstance, readFolders } from "../../util/readStub"

// 书影空壳页不上线(filters/readStub.ts),别的页里链向它的地方(多半是书页底部的
// 「相关:[[a]] · [[b]]」)要是还留着链接,点进去就是 404。这里把这些链接拆成纯文字。
//
// 过滤器只看得到当前这一页,判断「链接目标是不是空壳」得先知道全集,所以开工前
// 把 readFolders 下的源文件扫一遍、按同一口径算出空壳 slug 集合。必须放在 CrawlLinks 之后
// (要用它写好的 data-slug)。
function collectStubSlugs(contentDir: string): Set<FullSlug> {
  const stubs = new Set<FullSlug>()
  const walk = (dir: string) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(abs)
      } else if (entry.name.endsWith(".md")) {
        const rel = path.relative(contentDir, abs).split(path.sep).join("/")
        const src = fs.readFileSync(abs, "utf-8")
        let frontmatter: Record<string, any> = {}
        try {
          frontmatter = matter(src).data
        } catch {
          // frontmatter 写坏了就按没覆盖处理,只看字数
        }
        if (isReadStub(rel, frontmatter, measureSubstance(src))) {
          stubs.add(slugifyFilePath(rel as FilePath))
        }
      }
    }
  }
  for (const folder of readFolders) walk(path.join(contentDir, folder))
  return stubs
}

export const ReadStubLinks: QuartzTransformerPlugin = () => ({
  name: "ReadStubLinks",
  htmlPlugins(ctx) {
    const stubs = collectStubSlugs(ctx.argv.directory)
    return [
      () => (tree: Root) => {
        if (stubs.size === 0) return
        visit(tree, "element", (node: Element) => {
          if (node.tagName !== "a") return
          const slug = node.properties?.["data-slug"]
          if (typeof slug !== "string" || !stubs.has(slug as FullSlug)) return
          node.tagName = "span"
          node.properties = { className: ["read-stub-link"] }
        })
      },
    ]
  },
})
