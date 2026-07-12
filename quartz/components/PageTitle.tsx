import { FullSlug, joinSegments, pathToRoot, resolveRelative } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"

const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
  const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
  const slug = fileData.slug!
  // 英文页的站点标题指向英文首页,避免一点标题就跳回中文站
  const isEnglish = slug === "en" || slug.startsWith("en/")
  const baseDir = isEnglish ? resolveRelative(slug, "en/index" as FullSlug) : pathToRoot(slug)
  // 站点图标始终从站根取,避免英文页把图标路径也指到 en/ 下
  const iconSrc = joinSegments(pathToRoot(slug), "icon-circle.png")
  return (
    <h2 class={classNames(displayClass, "page-title")}>
      <a href={baseDir}>
        <img src={iconSrc} alt="" class="page-title-icon" />
        {title}
      </a>
    </h2>
  )
}

PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
}
/* flex(块级)而非 inline-flex:避免图标作为行内原子盒被 h2 行盒二次加行距、
   把整条 header 顶高;块级下高度 = max(图标, 文字行高) = 与纯文字标题一致 */
.page-title a {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: fit-content;
}
.page-title-icon {
  width: 1.8rem;
  height: 1.8rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
`

export default (() => PageTitle) satisfies QuartzComponentConstructor
