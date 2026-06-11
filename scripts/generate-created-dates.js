// Precompute a note -> creation-timestamp manifest from git history.
//
// Why this exists: RandomNotes' "最新" tab needs each note's creation date.
// Deriving it from git at build time fails on Cloudflare Pages because Pages
// does a shallow clone (depth 1), so `git log --diff-filter=A` can't see when
// files were first added — every note collapses to the HEAD commit and the
// "最新" order becomes meaningless.
//
// Instead we generate the manifest locally (full history) and commit it. The
// component reads the committed JSON, so the deployed site gets correct dates
// regardless of clone depth.

import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, "..", "quartz", "static", "created-dates.json")

function isShallow() {
  try {
    return execSync("git rev-parse --is-shallow-repository", { encoding: "utf-8" }).trim() === "true"
  } catch {
    return false
  }
}

// On a shallow clone (e.g. Cloudflare Pages build) we can't reconstruct real
// creation dates — keep the committed manifest instead of clobbering it.
if (isShallow() && fs.existsSync(OUT)) {
  console.log("[created-dates] shallow clone detected; keeping committed manifest")
  process.exit(0)
}

const raw = execSync(
  'git -c core.quotePath=false log --diff-filter=A --pretty="format:%at" --name-only -- content/',
  { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 },
)

const map = {}
let currentTs = 0
for (const line of raw.split("\n")) {
  const trimmed = line.trim()
  if (!trimmed) continue
  if (/^\d+$/.test(trimmed)) {
    currentTs = parseInt(trimmed, 10) * 1000
  } else if (currentTs && trimmed.startsWith("content/")) {
    const rel = trimmed.slice("content/".length)
    // git log is newest-first; first occurrence = most recent Add of this path.
    if (!(rel in map)) {
      map[rel] = currentTs
    }
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(map))
console.log(`[created-dates] wrote ${Object.keys(map).length} entries -> ${path.relative(process.cwd(), OUT)}`)
