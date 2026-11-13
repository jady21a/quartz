import { i18n } from "../../i18n"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { noteTimestamp } from "../../util/noteCreated"

// 404 页会在任意层级的地址下被托出来,所以这里的链接一律写根绝对路径。
// 除了「返回首页」,再给几个常用入口和最近几期视频,别让读者停在死胡同。
const NotFound: QuartzComponent = ({ cfg, allFiles }: QuartzComponentProps) => {
  // If baseUrl contains a pathname after the domain, use this as the home link
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
  const baseDir = url.pathname
  const abs = (slug: string) => baseDir.replace(/\/$/, "") + "/" + slug

  const sections = [
    { href: abs("videos/video-collection"), name: "视频合集" },
    { href: abs("videos/topic-collection"), name: "专题合集" },
    { href: abs("templates/"), name: "模板库" },
    { href: abs("library"), name: "藏书馆" },
  ]
  const recent = (allFiles ?? [])
    .filter((f) => f.slug && /^videos\/video-notes\/(?!index$)/.test(f.slug))
    .map((f) => ({ f, ts: noteTimestamp(f) }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 4)

  return (
    <article class="popover-hint">
      <h1>404</h1>
      <p>{i18n(cfg.locale).pages.error.notFound}</p>
      <p>
        <a href={baseDir}>{i18n(cfg.locale).pages.error.home}</a>
        {sections.map((s) => (
          <>
            {" · "}
            <a href={s.href}>{s.name}</a>
          </>
        ))}
      </p>
      {recent.length > 0 && (
        <>
          <h3>最近的视频笔记</h3>
          <ul>
            {recent.map(({ f }) => (
              <li>
                <a href={abs(f.slug!)}>{f.frontmatter?.title}</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  )
}

export default (() => NotFound) satisfies QuartzComponentConstructor
