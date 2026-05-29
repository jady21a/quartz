import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/randomNotes.scss"

interface Options {
  title?: string
  limit?: number
  showTags?: boolean
}

const defaultOptions: Options = {
  title: "漫步笔记",
  limit: 3,
  showTags: true,
}

export default ((userOpts?: Partial<Options>) => {
  const opts = { ...defaultOptions, ...userOpts } as Required<Options>

  const RandomNotes: QuartzComponent = ({
    allFiles,
    fileData,
    displayClass,
  }: QuartzComponentProps) => {
    // 过滤掉当前页面、索引页、电影笔记以及内容过短的笔记
    const currentSlug = fileData.slug
    const eligibleFiles = allFiles.filter(
      (file) =>
        file.slug !== currentSlug &&
        !file.slug?.endsWith("index") &&
        file.frontmatter?.title &&
        !(file.frontmatter?.tags || []).includes("movies") &&
        file.text &&
        file.text.trim().length > 121,
    )

    if (eligibleFiles.length === 0) {
      return null
    }

    // 服务端渲染一组初始随机笔记（无需 JS 也可显示）；
    // 「换一批」时客户端复用已经预取的 fetchData（contentIndex），不再为每个页面内嵌全量数据。
    const initial = [...eligibleFiles].sort(() => Math.random() - 0.5).slice(0, opts.limit)

    return (
      <div
        class={`random-notes ${displayClass ?? ""}`}
        data-random-notes
        data-slug={currentSlug}
        data-limit={String(opts.limit)}
        data-show-tags={String(opts.showTags)}
      >
        <h3>{opts.title}</h3>
        <ul class="random-notes-list" data-random-notes-list>
          {initial.map((file) => {
            const title = file.frontmatter?.title || file.slug || "Untitled"
            const tags = file.frontmatter?.tags || []
            return (
              <li key={file.slug}>
                <a href={`/${file.slug}`} class="internal">
                  {title}
                </a>
                {opts.showTags && tags.length > 0 && (
                  <div class="random-note-tags">
                    {tags.slice(0, 2).map((tag: string) => (
                      <span class="tag" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <button class="refresh-button" data-refresh-random-notes aria-label="刷新随机笔记">
          换一批
        </button>
      </div>
    )
  }

  RandomNotes.afterDOMLoaded = `
    function escapeHTML(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
      })
    }

    async function setupRandomNotes() {
      const container = document.querySelector("[data-random-notes]")
      if (!container) return
      const list = container.querySelector("[data-random-notes-list]")
      const button = container.querySelector("[data-refresh-random-notes]")
      if (!list || !button) return

      const limit = parseInt(container.getAttribute("data-limit") || "3", 10)
      const showTags = container.getAttribute("data-show-tags") === "true"
      const currentSlug = container.getAttribute("data-slug") || ""

      async function eligible() {
        // fetchData 已在每个页面预取（供搜索使用），这里直接复用，无额外网络开销
        const data = await fetchData
        return Object.values(data).filter(function (d) {
          return (
            d.slug !== currentSlug &&
            !String(d.slug).endsWith("index") &&
            d.title &&
            !(d.tags || []).includes("movies") &&
            String(d.content || "").trim().length > 121
          )
        })
      }

      function renderItems(items) {
        list.innerHTML = items
          .map(function (d) {
            let tagsHtml = ""
            if (showTags && d.tags && d.tags.length > 0) {
              tagsHtml =
                '<div class="random-note-tags">' +
                d.tags
                  .slice(0, 2)
                  .map(function (t) {
                    return '<span class="tag">#' + escapeHTML(t) + "</span>"
                  })
                  .join("") +
                "</div>"
            }
            return (
              "<li><a href=\\"/" +
              d.slug +
              '" class="internal">' +
              escapeHTML(d.title) +
              "</a>" +
              tagsHtml +
              "</li>"
            )
          })
          .join("")
      }

      const onClick = async function (e) {
        e.preventDefault()
        const items = await eligible()
        const shuffled = items.sort(function () {
          return Math.random() - 0.5
        })
        renderItems(shuffled.slice(0, limit))
        button.style.transform = "rotate(360deg)"
        setTimeout(function () {
          button.style.transform = "rotate(0deg)"
        }, 300)
      }

      button.addEventListener("click", onClick)
      if (window.addCleanup) {
        window.addCleanup(function () {
          button.removeEventListener("click", onClick)
        })
      }
    }

    document.addEventListener("nav", setupRandomNotes)
  `

  RandomNotes.css = style
  return RandomNotes
}) satisfies QuartzComponentConstructor
