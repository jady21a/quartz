#!/usr/bin/env node
// 英文镜像同步检查:content/en/<路径> 对照 content/<同路径>,按 git 最后提交时间。
// 报三类(只报告不阻断,恒 exit 0):
//   STALE   中文比英文新 → 该重译更新。
//   ORPHAN  中文原文已删/改名 → 英文页悬空;能按同名文件猜到新位置就提示(多半 git mv 即可)。
//   MISSING 在翻译范围内、还没英文版的中文页 → 待翻清单。
// 两类良性情况不报警:
//   EN-ONLY 文件夹 index.md 无中文对应 —— 英文专属栏目落地页(中文侧靠 Quartz 自动列表),设计如此。
//   CURATED index.md 根首页是手写精简落地页,非镜像翻译,不做 STALE 判定。
// quartz-push 每 6 小时写日志,人工维护跑 npm run check-en,更新本体走 translate-site skill。
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const contentDir = path.join(root, "content")
const enDir = path.join(contentDir, "en")

// 不再翻译的隐藏文件夹:对齐 quartz.layout.ts Explorer filterFn 里不显示的文件夹。
// MISSING 和 STALE/ORPHAN 全跳过——不上导航的内容,存量英文页也不用跟着中文更新。
const HIDDEN_DIRS = ["6.about", "8.主题阅读"]
// MISSING 扫描排除的中文目录(相对 content/)。前四个对齐 quartz.config.ts 的 ignorePatterns
// (根本不发布);2.Read、3.Template 是本 skill 约定不翻:读书笔记、模板(存量英文模板页
// 仍参与 STALE 盯过期)。隐藏目录(.obsidian/.trash)另行跳过。
const EXCLUDE_DIRS = [
  "private",
  "templates",
  ".obsidian",
  ".trash",
  "2.Read",
  "3.Template",
  ...HIDDEN_DIRS,
]
// 策展页:手写精简落地页,非逐篇镜像翻译,不参与 STALE(相对 en/)。
const CURATED = ["index.md"]

function lastCommit(rel) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ct", "--", rel], { cwd: root })
      .toString()
      .trim()
    return out ? Number(out) : null // 未被 git 跟踪(如刚翻完没提交)→ null,视为新鲜
  } catch {
    return null
  }
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name.startsWith(".")) continue // 跳过隐藏目录
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (e.name.endsWith(".md")) yield p
  }
}

const isExcluded = (rel) =>
  EXCLUDE_DIRS.some((d) => rel === d || rel.startsWith(d + path.sep)) ||
  rel.split(path.sep).some((seg) => seg.startsWith("."))

// 按同名文件猜中文源被搬到哪了(index.md 每个文件夹都有,猜了没意义,不猜)
function guessMoved(base) {
  if (base === "index.md") return null
  try {
    for (const zhPath of walk(contentDir)) {
      if (zhPath.startsWith(enDir + path.sep)) continue
      if (path.basename(zhPath) === base) return path.relative(contentDir, zhPath)
    }
  } catch {}
  return null
}

const stale = []
const orphan = []
const isHidden = (rel) => HIDDEN_DIRS.some((d) => rel === d || rel.startsWith(d + path.sep))

for (const enPath of walk(enDir)) {
  const rel = path.relative(enDir, enPath)
  if (isHidden(rel)) continue // 隐藏文件夹的存量英文页不盯过期/孤儿
  const base = path.basename(rel)
  const zhPath = path.join(contentDir, rel)
  if (!fs.existsSync(zhPath)) {
    // 文件夹 index.md 没中文对应 = 英文专属栏目落地页,正常,不算孤儿
    if (base === "index.md") continue
    const moved = guessMoved(base)
    orphan.push(moved ? `${rel}(疑似移到 ${moved},多半 git mv 即可)` : `${rel}(中文已删)`)
    continue
  }
  if (CURATED.includes(rel)) continue // 策展页跳过 STALE
  const zh = lastCommit(path.join("content", rel))
  const en = lastCommit(path.join("content", "en", rel))
  if (zh && en && zh > en) {
    stale.push(`${rel}(中文晚 ${Math.round((zh - en) / 86400)} 天)`)
  }
}

// MISSING:范围内、无英文版的中文页
const missing = []
for (const zhPath of walk(contentDir)) {
  if (zhPath.startsWith(enDir + path.sep)) continue
  const rel = path.relative(contentDir, zhPath)
  if (isExcluded(rel)) continue
  if (!fs.existsSync(path.join(enDir, rel))) missing.push(rel)
}

if (stale.length === 0 && orphan.length === 0 && missing.length === 0) {
  console.log("✅ 英文镜像已同步(无过期/孤儿/待翻)")
} else {
  if (stale.length) {
    console.log(`⚠️ ${stale.length} 页英文已过期(中文更新在后):`)
    for (const s of stale) console.log("  - " + s)
  }
  if (orphan.length) {
    console.log(`⚠️ ${orphan.length} 页英文成孤儿(中文原文已删/改名):`)
    for (const s of orphan) console.log("  - " + s)
  }
  if (missing.length) {
    console.log(`ℹ️ ${missing.length} 页中文在范围内、尚无英文版(按需翻):`)
    for (const s of missing) console.log("  - " + s)
  }
  console.log("更新走 translate-site skill:STALE→重译,ORPHAN→git mv,MISSING→按需翻")
}
