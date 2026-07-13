// scripts/verify-index.mjs
// 部署前一致性校验：画廊索引(*-index.json)里的每个 file 链接，
// 必须能对上一个「git 实际跟踪的」markdown 页面的 slug。
//
// 为什么要按 git 而不是磁盘：Cloudflare 是从 git 检出的文件名构建 HTML 的，
// 而索引是在本机按磁盘文件名生成的。macOS 大小写不敏感 + git core.ignorecase
// 会让「只改大小写」的重命名进不了 git → 索引(新名) 与 部署 HTML(旧名) 对不上
// → 画廊点链接 404。本脚本在 push 前抓出这种错配，宁可中止也不静默发 404。
//
// 退出码：0=一致；1=发现错配（quartz-push.sh 的 set -e/trap 会弹窗中止）。

import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.join(__dirname, "..")
const STATIC = path.join(REPO, "quartz", "static")

// 与 quartz/util/path.ts 的 sluggify 完全一致(含中文段→英文映射;注意:Quartz 不转小写,保留原大小写)
import { sluggify } from "./slug-map-util.js"

// content/7.video/Metadata/010-Obsidian homepage.md → /7.video/Metadata/010-Obsidian-homepage
function slugOfTrackedFile(repoRelPath) {
  const rel = repoRelPath.replace(/^content\//, "").replace(/\.md$/, "")
  let slug = sluggify(rel)
  if (slug.endsWith("_index")) slug = slug.replace(/_index$/, "index")
  return "/" + slug
}

// git 实际跟踪 + 已暂存的 markdown（core.quotepath=false 拿到原始 UTF-8 中文名）
function trackedSlugSet() {
  const out = execSync('git -c core.quotepath=false ls-files "content/**/*.md"', {
    cwd: REPO,
    encoding: "utf-8",
  })
  const set = new Set()
  for (const line of out.split("\n")) {
    const p = line.trim()
    if (p) set.add(slugOfTrackedFile(p))
  }
  return set
}

const INDEXES = ["video-index.json", "book-index.json", "movie-index.json"]

function main() {
  const tracked = trackedSlugSet()
  const problems = []

  for (const name of INDEXES) {
    const fp = path.join(STATIC, name)
    if (!fs.existsSync(fp)) continue
    let items
    try {
      items = JSON.parse(fs.readFileSync(fp, "utf-8"))
    } catch (e) {
      problems.push(`${name}: JSON 解析失败 ${e.message}`)
      continue
    }
    for (const item of items) {
      const file = item.file || ""
      // 外链 / 非内部页面跳过
      if (!file || /^https?:\/\//.test(file)) continue
      const slug = file.replace(/\.(md|html)$/, "")
      if (!tracked.has(slug)) {
        problems.push(`${name}: "${item.title || file}" → ${file} 在 git 里找不到对应页面`)
      }
    }
  }

  if (problems.length > 0) {
    console.error("❌ 索引与 git 跟踪的页面不一致（部署后会 404）：")
    for (const p of problems) console.error("   - " + p)
    console.error(
      "修复：多半是只改了文件名大小写但 git 没记上。用 git mv -f 经临时名两步把新名提交进 git，再 npm run generate-videos。",
    )
    process.exit(1)
  }

  console.log("✅ 索引一致性校验通过：所有画廊链接都能对上 git 里的页面")
}

main()
