// 中文路径段 → 英文 slug 的共享实现,与 quartz/util/path.ts 的 sluggify 行为完全一致
// (含 slug-map.json 映射;注意:Quartz 不转小写,保留原大小写)。
// 所有 scripts/ 下需要把 content 路径转成站点 URL 的脚本都从这里 import,
// 避免五份手抄副本在映射规则变化时漂移。
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function sluggifySegment(segment) {
  return segment
    .replace(/\s/g, "-")
    .replace(/&/g, "-and-")
    .replace(/%/g, "-percent")
    .replace(/\?/g, "")
    .replace(/#/g, "")
}

const rawSlugMap = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../quartz/util/slug-map.json"), "utf-8"),
)
const SEGMENT_MAP = new Map()
for (const [k, v] of Object.entries(rawSlugMap)) {
  if (k === "//") continue
  SEGMENT_MAP.set(k, v)
  SEGMENT_MAP.set(sluggifySegment(k), v)
}

export function sluggify(s) {
  return s
    .split("/")
    .map(
      (segment) =>
        SEGMENT_MAP.get(segment) ??
        SEGMENT_MAP.get(sluggifySegment(segment)) ??
        sluggifySegment(segment),
    )
    .join("/")
    .replace(/\/$/, "")
}

// 资产文件路径(图片等)与 Quartz 的 slugifyFilePath 同规则:先去扩展名、
// 段名映射、再接回扩展名。不能整段直接 sluggify——"谍影重重.webp" 带着
// 扩展名匹配不上映射键,会和 Assets emitter 的落盘路径(已映射)对不上 → 404。
export function slugifyAssetPath(p) {
  const clean = p.replace(/^\/+|\/+$/g, "")
  const ext = clean.match(/\.[A-Za-z0-9]+$/)?.[0] ?? ""
  const withoutExt = ext ? clean.slice(0, -ext.length) : clean
  return sluggify(withoutExt) + ext
}
