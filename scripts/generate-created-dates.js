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
    return (
      execSync("git rev-parse --is-shallow-repository", { encoding: "utf-8" }).trim() === "true"
    )
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

// Walk history oldest-first with rename detection. We track each file's
// original creation timestamp and carry it across renames, so a note keeps its
// real creation date even after its filename (slug) changes. Without this, a
// renamed note's `--diff-filter=A` entry only exists under the old path and the
// current path resolves to no date — which is exactly what sank note 009.
const raw = execSync(
  "git -c core.quotePath=false log --reverse --name-status -M --pretty=format:@%at -- content/",
  { encoding: "utf-8", maxBuffer: 80 * 1024 * 1024 },
)

const PREFIX = "content/"
const created = {} // path (relative to content/) -> creation ts (ms)
let currentTs = 0

const strip = (p) => (p.startsWith(PREFIX) ? p.slice(PREFIX.length) : null)

for (const line of raw.split("\n")) {
  if (!line) continue
  if (line[0] === "@") {
    currentTs = parseInt(line.slice(1), 10) * 1000
    continue
  }
  const parts = line.split("\t")
  const status = parts[0]
  if (status[0] === "A" || status[0] === "C") {
    // Added (or copied) — first appearance of this path.
    const rel = strip(parts[1])
    if (rel && !(rel in created)) created[rel] = currentTs
  } else if (status[0] === "R") {
    // Renamed old -> new: carry the original creation date to the new path.
    const oldRel = strip(parts[1])
    const newRel = strip(parts[2])
    if (newRel) {
      created[newRel] = (oldRel && created[oldRel]) || currentTs
      if (oldRel) delete created[oldRel]
    }
  } else if (status[0] === "D") {
    const rel = strip(parts[1])
    if (rel) delete created[rel]
  }
}

const map = created

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(map))
console.log(
  `[created-dates] wrote ${Object.keys(map).length} entries -> ${path.relative(process.cwd(), OUT)}`,
)
