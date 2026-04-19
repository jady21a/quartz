import mappingJson from "../../scripts/image-mapping.json"

type CoverMapping = {
  books: Record<string, string>
  movies: Record<string, string>
}

const mapping = mappingJson as CoverMapping

function asDisplayString(v: unknown): string {
  if (v === undefined || v === null) return ""
  if (Array.isArray(v)) {
    const first = v[0]
    return first === undefined || first === null ? "" : String(first).trim()
  }
  return String(v).trim()
}

/** 与 generate-book-index / generate-movies 中映射查找顺序尽量一致 */
function titleKeys(fm: Record<string, unknown>, relativePath?: string): string[] {
  const keys: string[] = []
  const push = (s: string) => {
    const t = s.trim()
    if (t && !keys.includes(t)) keys.push(t)
  }
  push(asDisplayString(fm.title))
  push(asDisplayString(fm.originalTitle))
  push(asDisplayString(fm.CNTitle))
  if (relativePath) {
    const base = relativePath.split("/").pop()?.replace(/\.md$/i, "") ?? ""
    push(base)
  }
  return keys
}

function lookupMapping(kind: "book" | "movie", keys: string[]): string | undefined {
  const table = kind === "book" ? mapping.books : mapping.movies
  for (const k of keys) {
    const hit = table[k]
    if (hit) return hit
  }
  return undefined
}

/**
 * 详情页封面 URL：优先 image-mapping、再豆瓣图 ID → /imgs/、其余外链走 weserv。
 * 与 JSON 索引里的 processImagePath 行为对齐，避免「列表有图、内页无图」。
 */
export function resolveCoverUrl(
  raw: unknown,
  fm: Record<string, unknown>,
  relativePath: string | undefined,
  kind: "book" | "movie",
): string {
  if (typeof raw !== "string" || !raw.trim()) return ""

  const mapped = lookupMapping(kind, titleKeys(fm, relativePath))
  if (mapped) {
    return mapped.startsWith("./") ? mapped.slice(1) : mapped
  }

  const url = raw
    .replace(/^\uFEFF/, "")
    .replace(/^\t+/, "")
    .trim()

  if (url.startsWith("/imgs/") || url.startsWith("./imgs/")) {
    return url.startsWith("./") ? url.slice(1) : url
  }

  const match = url.match(/\/(s\d+|p\d+)\.(jpg|jpeg|webp|png)$/i)
  if (match) {
    return `/imgs/${match[1]}.${match[2]}`
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`
  }

  return url
}
