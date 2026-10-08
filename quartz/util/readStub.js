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

// ===== 书影简介摘要 =====
// vault 里的 desc 已换成自己写的 120 字内总结(2026-10-08);新导入的书影还带着插件抓来的
// 完整原文,等周期性地换成总结。在那之前,网站上(详情页 MediaInfo + 画廊空壳卡片)
// 一律只放开头一小段,不把整篇别人的文案搬上站——这里是唯一的截短口径。
export const DESC_MAX_WIDTH = 120

// 按「汉字宽」计:汉字算 1,拉丁字母/数字/空格算 0.5,中英文摘要读起来差不多长
function charWidth(c) {
  return c.charCodeAt(0) < 256 ? 0.5 : 1
}

export function excerptDesc(text) {
  // 豆瓣抓来的简介常带「※」分隔、尾巴多出几个引号,顺手清掉
  const s = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^["※\s]+|["\s]+$/g, "")
    .replace(/\s*※\s*/g, " ")
  let width = 0
  let cut = s.length
  for (let i = 0; i < s.length; i++) {
    width += charWidth(s[i])
    if (width > DESC_MAX_WIDTH) {
      cut = i
      break
    }
  }
  if (cut === s.length) return s
  const head = s.slice(0, cut)
  // 优先在句末断;没有合适的句末就退到分句处,别把人名切成两半;都太靠前才硬切
  const sentence = [...head.matchAll(/[。！？!?]|\.(?=\s)/g)].pop()
  if (sentence && sentence.index >= cut * 0.5) return head.slice(0, sentence.index + 1)
  const clause = [...head.matchAll(/[，,；;]/g)].pop()
  if (clause && clause.index >= cut * 0.5) return head.slice(0, clause.index) + "…"
  return head.replace(/[，,、；;：:\s]+$/, "") + "…"
}
