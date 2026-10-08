import { Root } from "mdast"
import { VFile } from "vfile"
import { QuartzTransformerPlugin } from "../types"
import { READ_STUB_MIN, measureSubstance } from "../../util/readStub"

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

// 计数规则与书影空壳页同一份(quartz/util/readStub.js),这里只是挂到 file.data 上。

// 书籍笔记:add-book 是自建库、douban 是抓来的元数据页,两处都按书对待
// (没打 tags 的老书页靠目录兜底)。
export const bookFolders = ["read/add-book/books", "read/douban/book"]

// 「空壳书页」的统一口径:侧栏「最新」、index.xml、newsletter.xml 三处共用,
// 免得同一本书在这边挡住、那边又漏出去。
// 2.Read 下的空壳页现在整页不上线(filters/readStub.ts),这里只剩兜底:
// 2.Read 以外打了 book 标签的页。门槛与 readStub 同一个数。
export const bookMinSubstance = READ_STUB_MIN

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
