// scripts/backfill-video-covers.mjs
// 视频封面自动回填：扫视频 Meta，凡是「有 bilibiliid、缺 cover」的笔记，
// 就按 BV 号调 B站 view 接口取封面(data.pic)，把 cover 写回 md 的 frontmatter。
//
// 为什么写回 md 而不是只在构建时填进 index：
//   - md 本身就是单一信源，抓一次永久留存;之后 generate-videos.js 直接读 cover，
//     不再依赖网络，B站接口抖动也不影响已填好的封面。
//   - 只有 cover 为空时才抓;已填(手填或抓过)的一律不动，幂等、可反复跑。
//   - 抓失败(接口不通/风控)时静默跳过，这次没填下次构建重试，期间画廊照旧回退
//     YouTube 缩略图，不会开天窗。
//
// 在 quartz-push.sh 里放在 generate-videos 之前跑;也可手动 `npm run backfill-covers`。

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.join(__dirname, "..")

// 扫这些目录下的视频 Meta(中文本体 + 英文镜像，两边都补)
const DIRS = [
  path.join(REPO, "content", "7.shared", "视频Meta"),
  path.join(REPO, "content", "en", "7.shared", "视频Meta"),
]

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

// 从任意形态的 bilibiliid 里提出 BV 号：裸 BV、分享链接、iframe 内嵌都覆盖。
function extractBV(raw) {
  if (!raw) return ""
  const m = String(raw).match(/BV[0-9A-Za-z]{8,}/)
  return m ? m[0] : ""
}

// 切出 frontmatter 文本块(首个 --- 与下一个 --- 之间)。
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return null
  return { block: m[1], start: m.index, end: m.index + m[0].length, full: m[0] }
}

// frontmatter 里 cover 是否已有非空值。
function hasCover(block) {
  const m = block.match(/^cover:[ \t]*(.*)$/m)
  return !!(m && m[1].trim())
}

function getBilibiliRaw(block) {
  const m = block.match(/^bilibiliid:[ \t]*(.*)$/m)
  return m ? m[1].trim() : ""
}

// 把 cover 写进 frontmatter 块：已有空 cover 行则替换，否则插到 bilibiliid 行之后。
function writeCover(block, url) {
  if (/^cover:[ \t]*.*$/m.test(block)) {
    return block.replace(/^cover:[ \t]*.*$/m, `cover: ${url}`)
  }
  if (/^bilibiliid:[ \t]*.*$/m.test(block)) {
    return block.replace(/^(bilibiliid:[ \t]*.*)$/m, `$1\ncover: ${url}`)
  }
  // 没 bilibiliid 行也没 cover 行,追加到块末尾(理论上不会走到)
  return `${block}\ncover: ${url}`
}

async function fetchCover(bv) {
  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bv}`
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Referer: "https://www.bilibili.com/" },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data.code !== 0) throw new Error(`bili code ${data.code}: ${data.message || ""}`)
  const pic = data?.data?.pic
  if (!pic) throw new Error("no pic in response")
  // 一律升级为 https,避免 https 站点上的 mixed-content 拦截。
  return String(pic)
    .trim()
    .replace(/^http:\/\//i, "https://")
}

async function run() {
  let filled = 0
  let skipped = 0
  let failed = 0

  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(dir, f))

    for (const file of files) {
      const text = fs.readFileSync(file, "utf8")
      const fm = splitFrontmatter(text)
      if (!fm) continue
      if (hasCover(fm.block)) {
        skipped++
        continue
      }
      const bv = extractBV(getBilibiliRaw(fm.block))
      if (!bv) {
        skipped++
        continue
      }
      try {
        const cover = await fetchCover(bv)
        const newBlock = writeCover(fm.block, cover)
        const newText = text.replace(fm.full, `---\n${newBlock}\n---\n`)
        fs.writeFileSync(file, newText)
        filled++
        console.log(`✓ ${path.basename(file)} ← ${cover}`)
      } catch (e) {
        failed++
        console.warn(
          `✗ ${path.basename(file)} (${bv}): ${e.message} — 跳过,构建回退 YouTube 缩略图`,
        )
      }
      // 礼貌节流,避免连打 B站接口触发风控
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  console.log(`封面回填完成:填入 ${filled},跳过 ${skipped},失败 ${failed}`)
}

run()
