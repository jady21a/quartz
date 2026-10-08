// 书影「空壳页」的唯一口径 —— Quartz 构建(TS,经 readStub.d.ts)和画廊索引脚本
// (scripts/generate-book-index.js / generate-movies.js,纯 node)共用这一份,
// 免得「页面没生成」和「画廊卡片还能点」各算各的,一边改了另一边点进去 404。
//
// 空壳 = 2.Read 下的书/影视页,自己写的字不到 READ_STUB_MIN 个。
// 空壳页不单独上线(filters/readStub.ts 整页剔除),画廊里照常显示卡片、但不可点,
// 别的页链向它的地方渲染成纯文字(transformers/readStubLinks.ts)。
// 哪天笔记写起来、过了门槛,下一轮发布自动上线,不用手动管。
//
// 手动覆盖:frontmatter 写 `publish: true` 强制上线(比如一句话短评也想单独成页),
// `publish: false` 强制不上线。

// 门槛 120 字:2026-10 实测(去掉「相关:」交叉链接行之后),只有读前疑问清单 /
// 一两句随手记的页都在 102 字以下,写了正经笔记的从 120 起步。
export const READ_STUB_MIN = 120

// 按 content 相对路径判断,两边都拿得到(Quartz 是 file.data.relativePath)
export const readFolders = ["2.Read/add-book/books/", "2.Read/douban/", "2.Read/media-DB/"]

// 骨架行:标题、分隔线、只有标签没填内容的行(「- 一句话主旨:」)、
// 只加粗的小标题(「**读前疑问**」)、中文序号小节名(「一、主题」)。
const skeletonPatterns = [
  /^#{1,6}\s/,
  /^-{3,}$/,
  /^\*{0,2}[^:：]{0,30}[:：]\*{0,2}$/,
  /^\*\*[^*]+\*\*$/,
  /^[一二三四五六七八九十]+、\s*\S{0,12}$/,
]

// 不是自己写的行:页尾自动补的交叉链接「相关:[[a]] · [[b]]」、单独一行的图片
const generatedPatterns = [/^相关[:：]/, /^!\[[^\]]*\]\([^)]*\)$/, /^!\[\[[^\]]*\]\]$/]

// 「实质字数」= 剔掉模板骨架之后,笔记里真正自己写下的字数。基于原始 markdown 源码。
export function measureSubstance(src) {
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
    let content = line
      .replace(/^([-*+]|\d+[.)])\s*/, "")
      .replace(/^>+\s*/, "")
      .trim()
    if (generatedPatterns.some((re) => re.test(content))) continue
    // 影视模板的「Comment:」标签后面常直接跟正文,只剥标签、留正文
    content = content.replace(/^comment(\s*[:：]\s*|\s*$)/i, "")
    if (!content) continue
    if (skeletonPatterns.some((re) => re.test(content))) continue
    count += content.replace(/\s+/g, "").length
  }
  return count
}

function flag(v) {
  if (v === true || v === "true") return true
  if (v === false || v === "false") return false
  return undefined
}

export function isReadStub(relativePath, frontmatter, substanceLength) {
  const rel = String(relativePath || "").replace(/\\/g, "/")
  if (!readFolders.some((prefix) => rel.startsWith(prefix))) return false
  const override = flag(frontmatter && frontmatter.publish)
  if (override !== undefined) return !override
  return substanceLength < READ_STUB_MIN
}
