// scripts/generate-movies.js  (ESM版本)
import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { fileURLToPath } from "url"

// ===== 模拟 CommonJS 的 __dirname、__filename =====
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===== 配置 =====
const CONTENT_DIR = path.join(__dirname, "../content/2.Read") // Obsidian 笔记目录
const OUTPUT_FILE = path.join(__dirname, "../quartz/static/movie-index.json") // 输出到 movie-index.json

// ===== 递归读取所有 Markdown 文件 =====
function getAllMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
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

      // ✅ 改进版：支持字符串和 Date 对象
      function cleanDate(value) {
        if (!value) return '';
        if (value instanceof Date) {
          // 转成 ISO 字符串再截断
          return value.toISOString().split('T')[0];
        }
        if (typeof value === 'string') {
          // 去掉 T 及其后面的内容
          return value.split('T')[0];
        }
        return value;
      }
// ===== 解析影片数据 =====
function parseMovieData(filePath) {
  const content = fs.readFileSync(filePath, "utf-8")
  const { data: frontmatter } = matter(content)

  const tags = frontmatter.tags || []
  const isMovie = tags.some(
    (tag) =>
      tag &&
      ["movies", "movie", "teleplay", "tv", "电影", "电视剧"].includes(
        tag.toLowerCase()
      )
  )
  if (!isMovie) return null

  const relativePath = path
    .relative(CONTENT_DIR, filePath)
    .replace(/\\/g, "/")
    .replace(/\.md$/, "")

  let title = normalizeField(frontmatter.title)
  if (!title) title = path.basename(filePath, ".md")

  return {
    title,
    file: "/" + relativePath,
    tags,
    type: normalizeField(frontmatter.type),
    score: normalizeField(frontmatter.score),
    scoreStar: normalizeField(frontmatter.scoreStar),
    myRate: normalizeField(frontmatter.myRating),
    封面: normalizeField(frontmatter.封面),
    originalTitle: normalizeField(frontmatter.originalTitle),
    aliases: normalizeField(frontmatter.aliases),
    genre: normalizeField(frontmatter.genre),
    country: normalizeField(frontmatter.country),
    director: normalizeField(frontmatter.director),
    actor: normalizeField(frontmatter.actor),
    author: normalizeField(frontmatter.author),
    datePublished: cleanDate(frontmatter.datePublished),
    添加时间: cleanDate(frontmatter.添加时间 || ''),       // ✅
    开始时间: cleanDate(frontmatter.开始时间 || ''),
    结束阅读: cleanDate(frontmatter.结束阅读 || ''),  
    createTime: cleanDate(frontmatter.createTime),
    阅读状态: frontmatter.state || '',
    desc: normalizeField(frontmatter.desc),

  }
}

// ===== 主函数 =====
function generateMovieIndex() {
  console.log("🎬 开始生成影视库索引...")
  console.log("📂 扫描目录:", CONTENT_DIR)

  const outputDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  let existingData = []
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"))
      console.log("📖 读取现有索引:", existingData.length, "条记录")
    } catch {
      console.warn("⚠️ 无法读取现有索引,将创建新文件")
    }
  }

  const booksOnly = existingData.filter((item) => {
    const tags = item.tags || []
    const isMovie = tags.some(
      (tag) =>
        tag &&
        ["movies", "movie", "teleplay", "tv", "电影", "电视剧"].includes(
          tag.toLowerCase()
        )
    )
    return !isMovie
  })

  console.log("📚 保留书籍数据:", booksOnly.length, "条")

  const markdownFiles = getAllMarkdownFiles(CONTENT_DIR)
  console.log("📝 找到", markdownFiles.length, "个 Markdown 文件")

  const movies = []
  for (const filePath of markdownFiles) {
    try {
      const movieData = parseMovieData(filePath)
      if (movieData) movies.push(movieData)
    } catch (err) {
      console.error("❌ 解析文件失败:", filePath, err.message)
    }
  }

  console.log("🎬 找到", movies.length, "部影片")

  const allData = [...booksOnly, ...movies]

  const statusCount = {}
  for (const movie of movies) {
    const status = movie.观看状态 || movie.状态 || "Unknown"
    statusCount[status] = (statusCount[status] || 0) + 1
  }

  console.log("\n📊 影视状态统计:")
  for (const [status, count] of Object.entries(statusCount)) {
    console.log("   " + status + ": " + count)
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2), "utf-8")
  console.log("\n✅ 索引已更新:", OUTPUT_FILE)
  console.log("📚 书籍:", booksOnly.length, "条")
  console.log("🎬 影视:", movies.length, "条")
  console.log("📦 总计:", allData.length, "条\n")
}

// ===== 运行 =====
try {
  generateMovieIndex()
} catch (error) {
  console.error("❌ 生成失败:", error)
  process.exit(1)
}
