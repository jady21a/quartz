import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative } from "../util/path"
import { classNames } from "../util/lang"
import style from "./styles/videoNav.scss"

// 视频页底部:上一期 / 下一期。
// 读者看完一期没有下一步,只能回侧栏翻目录;这里补上「接着看」的出口。
// 邮件订阅框 2026-11-15 按用户要求从视频页撤掉,订阅入口只留首页。
// 期次按文件名前的编号(slug 字母序)排;中英两套各排各的。
const EPISODE = /^(en\/)?videos\/video-notes\/(?!index$)[^/]+$/

const VideoNav: QuartzComponent = ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug!
  if (!EPISODE.test(slug)) return null
  const isEn = slug.startsWith("en/")

  const episodes = allFiles
    .filter((f) => f.slug && EPISODE.test(f.slug) && f.slug.startsWith("en/") === isEn)
    .sort((a, b) => a.slug!.localeCompare(b.slug!, undefined, { numeric: true }))
  const i = episodes.findIndex((f) => f.slug === slug)
  const prev = i > 0 ? episodes[i - 1] : undefined
  const next = i >= 0 && i < episodes.length - 1 ? episodes[i + 1] : undefined

  const t = isEn
    ? {
        prev: "Previous",
        next: "Next",
      }
    : {
        prev: "上一期",
        next: "下一期",
      }

  if (!prev && !next) return null

  return (
    <section class={classNames(displayClass, "video-nav")}>
      <nav class="video-nav-links">
        {prev ? (
          <a class="internal video-nav-prev" href={resolveRelative(slug, prev.slug!)}>
            <span class="video-nav-label">{t.prev}</span>
            <span class="video-nav-title">{prev.frontmatter?.title}</span>
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a class="internal video-nav-next" href={resolveRelative(slug, next.slug!)}>
            <span class="video-nav-label">{t.next}</span>
            <span class="video-nav-title">{next.frontmatter?.title}</span>
          </a>
        ) : (
          <span />
        )}
      </nav>
    </section>
  )
}

VideoNav.css = style

export default (() => VideoNav) satisfies QuartzComponentConstructor
