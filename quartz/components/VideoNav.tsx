import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative } from "../util/path"
import { classNames } from "../util/lang"
import style from "./styles/videoNav.scss"

// 视频页底部:上一期 / 下一期 + 邮件订阅。
// 读者看完一期没有下一步,只能回侧栏翻目录;这里把「接着看」和「以后别错过」两个出口补上。
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
        subscribe: "Get new posts by email",
        placeholder: "Your email",
        button: "Subscribe",
      }
    : {
        prev: "上一期",
        next: "下一期",
        subscribe: "新内容发布时邮件通知你",
        placeholder: "你的邮箱",
        button: "订阅",
      }

  return (
    <section class={classNames(displayClass, "video-nav")}>
      {(prev || next) && (
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
      )}
      <p class="video-nav-subscribe-label">{t.subscribe}</p>
      {/* 和首页订阅表单同一个 class、同一个去处,样式和提交逻辑(static/subscribe.js)直接复用 */}
      <form
        class="home-subscribe"
        action="https://buttondown.com/api/emails/embed-subscribe/WhyZ"
        method="post"
        target="_blank"
      >
        <input type="email" name="email" placeholder={t.placeholder} required />
        <input type="hidden" name="embed" value="1" />
        <button type="submit">{t.button}</button>
      </form>
    </section>
  )
}

VideoNav.css = style

export default (() => VideoNav) satisfies QuartzComponentConstructor
