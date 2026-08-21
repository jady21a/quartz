import { Root } from "mdast"
import { VFile } from "vfile"
import { QuartzTransformerPlugin } from "../types"

// 「实质字数」= 剔掉模板骨架之后,笔记里真正自己写下的字数。
//
// 读书笔记都是用固定模板新建的(总结笔记 / Overview / 永久笔记 / prepare / 阅读笔记 ...),
// 刚加进来的书只有一副空骨架:字数看着不少,但没有一个字是自己写的。
// 侧栏「最新」用这个数把这类空壳页挡在外面(见 RandomNotes)。
// 统计基于原始 markdown 源码(和 GalleryAssets 一样),模板长什么样就按什么样识别。
declare module "vfile" {
  interface DataMap {
    substanceLength: number
  }
}

// 骨架行:标题、分隔线、只有标签没填内容的行(「- 一句话主旨:」)、
// 只加粗的小标题(「**读前疑问**」)、中文序号小节名(「一、主题」)。
const skeletonPatterns = [
  /^#{1,6}\s/,
  /^-{3,}$/,
  /^\*{0,2}[^:：]{0,30}[:：]\*{0,2}$/,
  /^\*\*[^*]+\*\*$/,
  /^[一二三四五六七八九十]+、\s*\S{0,12}$/,
]

function measureSubstance(src: string): number {
  // frontmatter 不算正文:书籍页的 desc(豆瓣简介)动辄几百字,是抓来的不是写的
  let body = src
  if (body.startsWith("---")) {
    const closing = body.indexOf("\n---", 3)
    if (closing !== -1) {
      const afterClosing = body.indexOf("\n", closing + 1)
      body = afterClosing === -1 ? "" : body.slice(afterClosing + 1)
    }
  }

  let count = 0
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    // 先剥掉列表符号和引用符号,再判断这行是不是骨架
    const content = line
      .replace(/^([-*+]|\d+[.)])\s*/, "")
      .replace(/^>+\s*/, "")
      .trim()
    if (!content) continue
    if (skeletonPatterns.some((re) => re.test(content))) continue
    count += content.replace(/\s+/g, "").length
  }
  return count
}

// 书籍笔记:add-book 是自建库、douban 是抓来的元数据页,两处都按书对待
// (没打 tags 的老书页靠目录兜底)。
export const bookFolders = ["read/add-book/books", "read/douban/book"]

// 「空壳书页」的统一口径:侧栏「最新」、index.xml、newsletter.xml 三处共用,
// 免得同一本书在这边挡住、那边又漏出去。
// 门槛 120 字:实测空壳书页只有 14~51 字,写了笔记的最少也有 890 字,落在中间很安全。
export const bookMinSubstance = 120

export function isBookStub(
  file: {
    slug?: string
    frontmatter?: Record<string, any>
    substanceLength?: number
  },
  minSubstance: number = bookMinSubstance,
): boolean {
  const slug = (file.slug ?? "").replace(/^en\//, "")
  const isBook =
    bookFolders.some((prefix) => slug.startsWith(prefix)) ||
    (file.frontmatter?.tags || []).includes("book")
  return isBook && (file.substanceLength ?? 0) < minSubstance
}

export const NoteSubstance: QuartzTransformerPlugin = () => ({
  name: "NoteSubstance",
  markdownPlugins() {
    return [
      () => (_tree: Root, file: VFile) => {
        file.data.substanceLength = measureSubstance(file.value?.toString() ?? "")
      },
    ]
  },
})
