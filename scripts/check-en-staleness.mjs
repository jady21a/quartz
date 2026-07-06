#!/usr/bin/env node
// 英文镜像过期检查:content/en/<路径> 对照 content/<同路径>,按 git 最后提交时间
// 列出「中文比英文新」的过期页和「中文原文已删/改名」的孤儿页。
// 只报告不阻断(恒 exit 0):quartz-push 每 6 小时写日志,人工维护跑 npm run check-en,
// 更新本体走 translate-site skill。
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const enDir = path.join(root, "content", "en")

function lastCommit(rel) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ct", "--", rel], {
      cwd: root,
    })
      .toString()
      .trim()
    return out ? Number(out) : null // 未被 git 跟踪(如刚翻完没提交)→ null,视为新鲜
  } catch {
    return null
  }
}

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (e.name.endsWith(".md")) yield p
  }
}

const stale = []
const orphan = []
for (const enPath of walk(enDir)) {
  const rel = path.relative(enDir, enPath)
  const zhPath = path.join(root, "content", rel)
  if (!fs.existsSync(zhPath)) {
    orphan.push(rel)
    continue
  }
  const zh = lastCommit(path.join("content", rel))
  const en = lastCommit(path.join("content", "en", rel))
  if (zh && en && zh > en) {
    stale.push(`${rel}(中文晚 ${Math.round((zh - en) / 86400)} 天)`)
  }
}

if (stale.length === 0 && orphan.length === 0) {
  console.log("✅ 英文镜像无过期页")
} else {
  if (stale.length) {
    console.log(`⚠️ ${stale.length} 页英文已过期(中文更新在后):`)
    for (const s of stale) console.log("  - " + s)
  }
  if (orphan.length) {
    console.log(`⚠️ ${orphan.length} 页英文成孤儿(中文原文已删/改名):`)
    for (const s of orphan) console.log("  - " + s)
  }
  console.log("更新走 translate-site skill(只翻列出的页)")
}
