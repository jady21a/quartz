import { Date, getDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { localeForSlug } from "../util/locale"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"

interface ContentMetaOptions {
  /**
   * Whether to display reading time
   */
  showReadingTime: boolean
  showComma: boolean
}

const defaultOptions: ContentMetaOptions = {
  showReadingTime: true,
  showComma: true,
}

// 这些是导览 / 索引类页面(首页、藏书馆、观影库、各类合集),正文多为内嵌脚本或纯链接,
// 日期和阅读时长都没有意义(阅读时长还会被订阅脚本撑得很离谱),整条 meta 不显示。
const hideMetaSlugs = new Set([
  "index",
  "library",
  "watch-list",
  "videos/index",
  "videos/video-collection",
  "videos/topic-collection",
])

export default ((opts?: Partial<ContentMetaOptions>) => {
  // Merge options with defaults
  const options: ContentMetaOptions = { ...defaultOptions, ...opts }

  function ContentMetadata({ cfg, fileData, displayClass }: QuartzComponentProps) {
    const text = fileData.text

    // 导览 / 索引类页面:日期和阅读时间都不显示。
    // 名单按映射后的英文 slug 维护,英文镜像(en/ 前缀)剥掉前缀后同样命中,保持两种语言一致。
    const slug = fileData.slug ?? ""
    const baseSlug = slug === "en" ? "index" : slug.startsWith("en/") ? slug.slice(3) : slug
    if (hideMetaSlugs.has(baseSlug)) {
      return null
    }

    if (text) {
      const locale = localeForSlug(fileData.slug, cfg.locale)
      const segments: (string | JSX.Element)[] = []

      if (fileData.dates) {
        segments.push(<Date date={getDate(cfg, fileData)!} locale={locale} />)
      }

      // Display reading time if enabled
      if (options.showReadingTime) {
        const { minutes, words: _words } = readingTime(text)
        const displayedTime = i18n(locale).components.contentMeta.readingTime({
          minutes: Math.ceil(minutes),
        })
        segments.push(<span>{displayedTime}</span>)
      }

      // 本页阅读量:由 busuanzi.js 运行时填充 #busuanzi_page_pv,填好前整段隐藏(hidden),
      // 后端不可用则一直不显示,不占位、不报错。
      segments.push(
        <span class="busuanzi-page" hidden>
          <span id="busuanzi_page_pv" />
          {" 次阅读"}
        </span>,
      )

      return (
        <p show-comma={options.showComma} class={classNames(displayClass, "content-meta")}>
          {segments}
        </p>
      )
    } else {
      return null
    }
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
