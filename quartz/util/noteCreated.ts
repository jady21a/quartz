import { execSync } from "child_process"
import fs from "fs"
import path from "path"

// 笔记“创建时间”的统一来源,侧栏「最新」(RandomNotes)和 RSS feed 共用,
// 保证两处的“最新”口径一致。
//
// Map of note relativePath -> creation timestamp (ms).
//
// Prefer the precomputed manifest (scripts/generate-created-dates.js). Building
// it from git at runtime breaks on Cloudflare Pages because Pages shallow-clones
// the repo, so `git log --diff-filter=A` can't see when notes were first added
// and the "最新" order collapses. The committed manifest carries the full-history
// dates, so the deployed site stays correct. Fall back to git for local dev when
// the manifest is missing.
function loadCreatedMap(): Map<string, number> {
  const manifestPath = path.join(process.cwd(), "quartz", "static", "created-dates.json")
  try {
    const obj = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Record<string, number>
    // key 统一小写:git 历史里记录的文件名大小写可能和磁盘当前文件名不一致
    // (例如先以小写名提交、后重命名为大写),区分大小写会导致查不到 → 该笔记从“最新”消失
    return new Map(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), Number(v)]))
  } catch {}
  return buildGitCreatedMap()
}

function buildGitCreatedMap(): Map<string, number> {
  const map = new Map<string, number>()
  try {
    const raw = execSync(
      'git -c core.quotePath=false log --diff-filter=A --pretty="format:%at" --name-only -- content/',
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    )
    let currentTs = 0
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/^\d+$/.test(trimmed)) {
        currentTs = parseInt(trimmed, 10) * 1000
      } else if (currentTs && trimmed.startsWith("content/")) {
        const rel = trimmed.slice("content/".length).toLowerCase()
        if (!map.has(rel)) {
          map.set(rel, currentTs)
        }
      }
    }
  } catch {}
  return map
}

const gitDateMap = loadCreatedMap()

// “最新”排序用的时间戳,查不到返回 0。
// 优先用 frontmatter 的 date —— 它写在文件里,随文件走,重命名/移动都不会丢;
// 没有 date 的笔记再回退到 git 新增清单(Cloudflare 浅克隆下唯一可靠的创建时间来源)。
// 清单按文件名查找,而文件名大小写或路径可能漂移,所以这层兜底不如 frontmatter 稳。
export function noteTimestamp(file: {
  frontmatter?: Record<string, unknown>
  relativePath?: string
}): number {
  const fm = file.frontmatter?.date as string | number | Date | undefined
  if (fm != null) {
    const t = new Date(fm).getTime()
    if (!Number.isNaN(t)) return t
  }
  return gitDateMap.get((file.relativePath ?? "").toLowerCase()) ?? 0
}
