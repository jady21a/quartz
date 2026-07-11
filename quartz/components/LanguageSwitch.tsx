import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/languageswitch.inline"
// @ts-ignore
import styles from "./styles/languageSwitch.scss"

const EN_PREFIX = "en/"

// 首访自动分流:手动选择(langPref)优先,否则按浏览器语言;非中文浏览器跳英文首页。
// 只内联在中文首页(深层链接不跳转),SPA 站内导航不会重跑,不会把人从内页拽走。
const homepageRedirectScript = `(function () {
  try {
    var pref = localStorage.getItem("langPref")
    var langs =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || "zh"]
    var wantEn = pref
      ? pref === "en"
      : !langs.some(function (l) {
          return l.toLowerCase().lastIndexOf("zh", 0) === 0
        })
    if (wantEn) location.replace("./en/")
  } catch (e) {}
})()`

// 中英语言切换：按 slug 前缀判断当前语言，查 allFiles 决定对应语言版本是否存在。
// 约定：英文版镜像在 content/en/<同路径>，slug 形如 "en/6.about/智囊团"。
const LanguageSwitch: QuartzComponent = ({
  fileData,
  allFiles,
  displayClass,
}: QuartzComponentProps) => {
  // 如果整站没有任何英文页（例如线上构建用 ignorePatterns 跳过了 en/），
  // 整个切换控件不渲染，避免页面上出现一个永远点不动的灰 EN。
  const hasEnglish = allFiles.some((f) => f.slug === "en" || f.slug?.startsWith(EN_PREFIX))
  if (!hasEnglish) {
    return null
  }

  const slug = fileData.slug!
  const isEnglish = slug === "en" || slug.startsWith(EN_PREFIX)
  const otherSlug = (isEnglish ? slug.slice(EN_PREFIX.length) : EN_PREFIX + slug) as FullSlug
  // 自动生成的文件夹页不在 allFiles 里；只要对应文件夹下有内容文件，Quartz 就会生成文件夹页
  const otherIsFolderPage =
    otherSlug.endsWith("/index") &&
    allFiles.some((f) => f.slug?.startsWith(otherSlug.slice(0, -"index".length)))
  const otherExists = otherIsFolderPage || allFiles.some((f) => f.slug === otherSlug)

  const item = (label: string, lang: "zh" | "en", active: boolean) => {
    if (active) {
      return <span class="lang active">{label}</span>
    }
    if (otherExists) {
      return (
        <a class="lang" data-lang={lang} href={resolveRelative(slug, otherSlug)}>
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
      {slug === "index" && otherExists && (
        <script dangerouslySetInnerHTML={{ __html: homepageRedirectScript }} />
      )}
      {item("中", "zh", !isEnglish)}
      <span class="lang-sep">/</span>
      {item("EN", "en", isEnglish)}
    </div>
  )
}

LanguageSwitch.css = styles
LanguageSwitch.afterDOMLoaded = script

export default (() => LanguageSwitch) satisfies QuartzComponentConstructor
