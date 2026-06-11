import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { classNames } from "../util/lang"
// @ts-ignore
import styles from "./styles/languageSwitch.scss"

const EN_PREFIX = "en/"

// 中英语言切换：按 slug 前缀判断当前语言，查 allFiles 决定对应语言版本是否存在。
// 约定：英文版镜像在 content/en/<同路径>，slug 形如 "en/6.about/智囊团"。
const LanguageSwitch: QuartzComponent = ({
  fileData,
  allFiles,
  displayClass,
}: QuartzComponentProps) => {
  const slug = fileData.slug!
  const isEnglish = slug === "en" || slug.startsWith(EN_PREFIX)
  const otherSlug = (isEnglish ? slug.slice(EN_PREFIX.length) : EN_PREFIX + slug) as FullSlug
  const otherExists = allFiles.some((f) => f.slug === otherSlug)

  const item = (label: string, active: boolean) => {
    if (active) {
      return <span class="lang active">{label}</span>
    }
    if (otherExists) {
      return (
        <a class="lang" href={resolveRelative(slug, otherSlug)}>
          {label}
        </a>
      )
    }
    return (
      <span class="lang disabled" title="暂无对应语言版本 / no translation yet">
        {label}
      </span>
    )
  }

  return (
    <div class={classNames(displayClass, "language-switch")}>
      {item("中", !isEnglish)}
      <span class="lang-sep">/</span>
      {item("EN", isEnglish)}
    </div>
  )
}

LanguageSwitch.css = styles

export default (() => LanguageSwitch) satisfies QuartzComponentConstructor
