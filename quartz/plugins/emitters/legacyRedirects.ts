import {
  FilePath,
  FullSlug,
  legacySlugifyFilePath,
  resolveRelative,
  simplifySlug,
  slugifyFilePath,
} from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

// 全站 URL 英文化(slug-map.json)后,线上已被收录/分享的旧中文 URL 会 404。
// 这里为每个「映射前 ≠ 映射后」的页面和文件夹,在旧 slug 位置发一个 meta-refresh
// 重定向 stub(带 canonical + noindex,和 AliasRedirects 同款)。
// 不走 frontmatter aliases 的原因:2.Read 每次发布都被 vault 整目录 rsync 覆盖,
// 写进 frontmatter 的别名活不过下一次同步;emitter 与内容文件解耦,不受影响。
function redirectPage(fromSlug: FullSlug, toSlug: FullSlug): string {
  const redirUrl = resolveRelative(fromSlug, simplifySlug(toSlug))
  return `
        <!DOCTYPE html>
        <html lang="en-us">
        <head>
        <title>${simplifySlug(toSlug)}</title>
        <link rel="canonical" href="${redirUrl}">
        <meta name="robots" content="noindex">
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="0; url=${redirUrl}">
        </head>
        </html>
        `
}

export const LegacyUrlRedirects: QuartzEmitterPlugin = () => ({
  name: "LegacyUrlRedirects",
  async *emit(ctx, content) {
    const emitted = new Set<string>()

    for (const [_tree, file] of content) {
      const rel = file.data.relativePath! as FilePath
      const newSlug = file.data.slug!

      // 页面级:旧中文页面 slug → 新英文页面
      const legacySlug = legacySlugifyFilePath(rel)
      if (legacySlug !== newSlug && !emitted.has(legacySlug)) {
        emitted.add(legacySlug)
        yield write({
          ctx,
          content: redirectPage(legacySlug, newSlug),
          slug: legacySlug,
          ext: ".html",
        })
      }

      // 文件夹级:该文件的每一层父目录,旧目录页 URL → 新目录页
      // (自动生成的文件夹页没有源文件,只能从文件路径反推)
      const segments = rel.split("/").slice(0, -1)
      for (let i = 1; i <= segments.length; i++) {
        const folder = segments.slice(0, i).join("/")
        const legacyFolderSlug = legacySlugifyFilePath((folder + "/index.md") as FilePath)
        if (emitted.has(legacyFolderSlug)) continue
        const newFolderSlug = slugifyFilePath((folder + "/index.md") as FilePath)
        if (legacyFolderSlug === newFolderSlug) continue
        emitted.add(legacyFolderSlug)
        yield write({
          ctx,
          content: redirectPage(legacyFolderSlug, newFolderSlug),
          slug: legacyFolderSlug,
          ext: ".html",
        })
      }
    }
  },
})
