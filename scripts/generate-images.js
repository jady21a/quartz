// scripts/generate-images.js
// 扫描 content/7.shared/ 目录,解析"图文"类 frontmatter,生成 image-index.json
// 与 generate-videos.js 平行:视频按 tag=video 收集,图文按 tag=图文 收集。
// 卡片复用视频卡样式(video-card / video-grid),由 gallery.js 的 imageConfig 渲染。

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===== 配置 =====
const CONTENT_DIR = path.join(__dirname, "../content")
const SCAN_DIR = path.join(CONTENT_DIR, "7.shared")
const OUTPUT_FILE = path.join(__dirname, "../quartz/static/image-index.json")

// 命中这些 tag(忽略大小写)的笔记视为"图文"
const IMAGE_TAGS = ["专题", "图文", "imagetext", "graphic", "专题教程", "图文教程"]

// ===== 递归读取所有 Markdown 文件 =====
function getAllMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.warn("⚠️  目录不存在:", dir)
    return fileList
  }
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith(".")) continue
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      getAllMarkdownFiles(filePath, fileList)
    } else if (file.endsWith(".md")) {
      fileList.push(filePath)
    }
  }
  return fileList
}

function normalizeField(field) {
  if (!field) return undefined
  if (Array.isArray(field)) {
    if (field.length === 0) return undefined
    if (field.length === 1) return field[0]
    return field.join(" / ")
  }
  return field
}

function cleanDate(value) {
  if (!value) return ""
  if (value instanceof Date) return value.toISOString().split("T")[0]
  if (typeof value === "string") return value.split("T")[0]
  return String(value)
}

// 与 Quartz 的 sluggify 保持一致:空格→-、&→-and-、%→-percent、去掉 ? #
// 其余字符(含中文、@、.)原样保留,否则资源/页面链接会和真实 slug 对不上 → 404
function sluggifyPath(p) {
  return p
    .split("/")
    .map((seg) =>
      seg
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, ""),
    )
    .join("/")
}

// 从正文里取第一张图片(支持 ![[x]] 和 ![](x))
function firstBodyImage(body) {
  if (!body) return ""
  const embed = body.match(/!\[\[([^\]]+?)\]\]/)
  if (embed) return embed[1].split("|")[0].trim()
  const md = body.match(/!\[[^\]]*\]\(([^)]+)\)/)
  if (md) return md[1].trim()
  return ""
}

// 把 cover 字段解析成可访问的 URL
//  - http(s) 外链:升级 https,原样返回(gallery.js 会按需走代理)
//  - 以 / 开头:站内绝对路径,原样返回
//  - 其余:视为相对当前笔记目录的 vault 路径(如 snap/封面.png),sluggify 后转绝对路径
function resolveCover(raw, postDirRel) {
  let cover = normalizeField(raw)
  if (!cover) return ""
  cover = String(cover).trim()
  // 去掉 Obsidian 嵌入/链接括号
  const bracket = cover.match(/^!?\[\[([^\]]+?)\]\]$/)
  if (bracket) cover = bracket[1].split("|")[0].trim()
  if (!cover) return ""
  if (/^https?:\/\//i.test(cover)) return cover.replace(/^http:\/\//i, "https://")
  if (cover.startsWith("/")) return cover
  const rel = path.posix.join(postDirRel.split(path.sep).join("/"), cover)
  return "/" + sluggifyPath(rel)
}

function parseImageData(filePath) {
  const content = fs.readFileSync(filePath, "utf-8")
  const { data: fm, content: body } = matter(content)

  const tags = fm.tags || []
  const isImage = tags.some(
    (t) => t && IMAGE_TAGS.includes(String(t).toLowerCase()),
  )
  if (!isImage) return null

  const relToContent = path.relative(CONTENT_DIR, filePath).replace(/\\/g, "/")
  const relNoExt = relToContent.replace(/\.md$/, "")
  const postDirRel = path.dirname(relToContent)

  let title = normalizeField(fm.title)
  if (!title) {
    const heading = body.match(/^#{1,6}\s+(.+)$/m)
    title = heading ? heading[1].trim() : path.basename(filePath, ".md")
  }

  let description = normalizeField(fm.description) || ""
  if (!description && body) {
    const firstPara = body
      .trim()
      .split("\n\n")
      .map((s) => s.trim())
      .find((s) => s && !s.startsWith("<") && !s.startsWith("#") && !s.startsWith("!["))
    if (firstPara) description = firstPara.replace(/^[>*\-\s]+/, "").slice(0, 200)
  }

  const coverRaw = fm.cover || firstBodyImage(body)

  return {
    title,
    file: "/" + sluggifyPath(relNoExt),
    tags,
    date: cleanDate(fm.date),
    description,
    category: normalizeField(fm.category) || "",
    thumbnail: resolveCover(coverRaw, postDirRel),
  }
}

function generateImageIndex() {
  console.log("🖼️  开始生成图文索引...")
  console.log("📂 扫描目录:", SCAN_DIR)

  const outputDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const files = getAllMarkdownFiles(SCAN_DIR)
  console.log("📝 找到", files.length, "个 Markdown 文件")

  const items = []
  for (const filePath of files) {
    try {
      const data = parseImageData(filePath)
      if (data) items.push(data)
    } catch (err) {
      console.error("❌ 解析文件失败:", filePath, err.message)
    }
  }

  items.sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })

  console.log("🖼️  找到", items.length, "篇图文")
  for (const it of items.slice(0, 5)) {
    console.log(`   ${it.title}  | 日期: ${it.date} | 分类: ${it.category} | 封面: ${it.thumbnail || "无"}`)
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2), "utf-8")
  console.log("\n✅ 图文索引已更新:", OUTPUT_FILE)
  console.log("📦 总计:", items.length, "篇\n")
}

try {
  generateImageIndex()
} catch (error) {
  console.error("❌ 生成失败:", error)
  process.exit(1)
}
