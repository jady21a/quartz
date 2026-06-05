// scripts/generate-videos.js
// 扫描 content/7.video/ 目录,解析视频 frontmatter,生成 video-index.json

import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===== 配置 =====
const CONTENT_DIR = path.join(__dirname, "../content/7.video")
const OUTPUT_FILE = path.join(__dirname, "../quartz/static/video-index.json")

// ===== 递归读取所有 Markdown 文件 =====
function getAllMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.warn("⚠️  目录不存在:", dir)
    return fileList
  }
  const files = fs.readdirSync(dir)
  for (const file of files) {
    if (file.startsWith(".")) continue // 跳过隐藏文件
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

// ===== 处理数组或字符串字段 =====
function normalizeField(field) {
  if (!field) return undefined
  if (Array.isArray(field)) {
    if (field.length === 0) return undefined
    if (field.length === 1) return field[0]
    return field.join(" / ")
  }
  return field
}

// ===== 标准化日期 =====
function cleanDate(value) {
  if (!value) return ""
  if (value instanceof Date) {
    return value.toISOString().split("T")[0]
  }
  if (typeof value === "string") {
    return value.split("T")[0]
  }
  return String(value)
}

function normalizeVideoSourceId(value) {
  const normalized = normalizeField(value)
  return normalized ? String(normalized).trim() : ""
}

// ===== YouTube 缩略图 URL =====
function getThumbnailUrl(videoid) {
  if (!videoid) return ""
  return `https://i.ytimg.com/vi/${videoid}/hqdefault.jpg`
}

function extractPlayerSource(bodyContent, sourceName) {
  if (!bodyContent) return ""
  const pattern = new RegExp(`data-${sourceName}="([^"]*)"`, "i")
  const match = bodyContent.match(pattern)
  return match?.[1]?.trim() || ""
}

function buildVideoSources(youtubeId, bilibiliId) {
  const sources = {}
  if (youtubeId) sources.youtube = youtubeId
  if (bilibiliId) sources.bilibili = bilibiliId
  return sources
}

function normalizeDefaultSource(value, sources) {
  const source = normalizeVideoSourceId(value).toLowerCase()
  if (source && sources[source]) return source
  return sources.youtube ? "youtube" : Object.keys(sources)[0] || ""
}

// ===== 从内容提取 wikilinks =====
function extractWikilinks(content) {
  if (!content) return []
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g
  const links = []
  let match
  while ((match = wikilinkRegex.exec(content)) !== null) {
    // 处理 [[path|label]] 格式
    const parts = match[1].split("|")
    links.push({
      target: parts[0].trim(),
      label: parts[1]?.trim() || parts[0].trim(),
    })
  }
  return links
}

// ===== 解析视频数据 =====
function parseVideoData(filePath) {
  const content = fs.readFileSync(filePath, "utf-8")
  const { data: frontmatter, content: bodyContent } = matter(content)

  const tags = frontmatter.tags || []
  const isVideo = tags.some(
    (tag) =>
      tag && ["video", "视频", "youtube", "教程"].includes(String(tag).toLowerCase()),
  )
  if (!isVideo) return null

  const relativePath = path
    .relative(CONTENT_DIR, filePath)
    .replace(/\\/g, "/")
    .replace(/\.md$/, "")

  let title = normalizeField(frontmatter.title)
  if (!title) title = path.basename(filePath, ".md")

  const videoid =
    normalizeVideoSourceId(frontmatter.videoid) ||
    extractPlayerSource(bodyContent, "youtube") ||
    ""
  const bilibiliid =
    normalizeVideoSourceId(frontmatter.bilibiliid) ||
    extractPlayerSource(bodyContent, "bilibili") ||
    ""
  const sources = buildVideoSources(videoid, bilibiliid)
  const defaultSource = normalizeDefaultSource(frontmatter.defaultSource, sources)

  // description: frontmatter 优先,否则用正文第一段
  let description = normalizeField(frontmatter.description) || ""
  if (!description && bodyContent) {
    const firstParagraph = bodyContent
      .trim()
      .split("\n\n")[0]
      ?.replace(/^[#\s>*-]+/, "")
      .trim()
    if (firstParagraph && !firstParagraph.startsWith("<")) {
      description = firstParagraph.slice(0, 200)
    }
  }

  return {
    title,
    videoid,
    bilibiliid,
    sources,
    defaultSource,
    file: "/7.video/" + relativePath,
    tags,
    date: cleanDate(frontmatter.date),
    description,
    category: normalizeField(frontmatter.category) || "",
    thumbnail: getThumbnailUrl(videoid),
    related_notes: extractWikilinks(bodyContent),
    aliases: normalizeField(frontmatter.aliases),
    createTime: cleanDate(frontmatter.createTime),
  }
}

// ===== 主函数 =====
function generateVideoIndex() {
  console.log("🎬 开始生成视频索引...")
  console.log("📂 扫描目录:", CONTENT_DIR)

  const outputDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const markdownFiles = getAllMarkdownFiles(CONTENT_DIR)
  console.log("📝 找到", markdownFiles.length, "个 Markdown 文件")

  const videos = []
  for (const filePath of markdownFiles) {
    try {
      const videoData = parseVideoData(filePath)
      if (videoData) videos.push(videoData)
    } catch (err) {
      console.error("❌ 解析文件失败:", filePath, err.message)
    }
  }

  // 按日期降序排列
  videos.sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })

  console.log("🎬 找到", videos.length, "个视频")

  // 分类统计
  const categoryCount = {}
  for (const video of videos) {
    const cat = video.category || "未分类"
    categoryCount[cat] = (categoryCount[cat] || 0) + 1
  }

  console.log("\n📊 分类统计:")
  for (const [cat, count] of Object.entries(categoryCount)) {
    console.log("   " + cat + ": " + count)
  }

  // 显示示例
  if (videos.length > 0) {
    console.log("\n🎬 示例视频:")
    for (const v of videos.slice(0, 3)) {
      console.log(`   标题: ${v.title}`)
      console.log(
        `   来源: ${Object.keys(v.sources || {}).join(", ") || "无"} | 日期: ${v.date} | 分类: ${v.category}`,
      )
      console.log("")
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(videos, null, 2), "utf-8")
  console.log("\n✅ 索引已更新:", OUTPUT_FILE)
  console.log("📦 总计:", videos.length, "个视频\n")
}

// ===== 运行 =====
try {
  generateVideoIndex()
} catch (error) {
  console.error("❌ 生成失败:", error)
  process.exit(1)
}
