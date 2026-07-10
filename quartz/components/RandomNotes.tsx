import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { noteTimestamp } from "../util/noteCreated"
import style from "./styles/randomNotes.scss"

// “最新”列表里每条笔记后面的日期,统一 YYYY-MM-DD;时间戳为 0(查不到日期)时返回空串不显示
function fmtDate(ts: number): string {
  if (!ts) return ""
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

interface Options {
  title?: string
  limit?: number
  showTags?: boolean
  recentLimit?: number
  excludeFolders?: string[]
  excludeSlugs?: string[]
}

const defaultOptions: Options = {
  title: "漫步笔记",
  limit: 3,
  showTags: true,
  recentLimit: 4,
  excludeFolders: [".trash", "1.", "2.Read/dataview", "2.Read/douban", "2.Read/media-DB", "3."],
  excludeSlugs: ["藏书馆", "观影库"],
}

export default ((userOpts?: Partial<Options>) => {
  const opts = { ...defaultOptions, ...userOpts } as Required<Options>

  const RandomNotes: QuartzComponent = ({
    allFiles,
    fileData,
    displayClass,
  }: QuartzComponentProps) => {
    const currentSlug = fileData.slug
    // 中英分站:随机/最新都只推当前页面语言的笔记,避免中文页漏出英文条目(反之亦然)
    const pageIsEnglish = currentSlug === "en" || (currentSlug ?? "").startsWith("en/")
    const sameLang = (slug: string | undefined) =>
      (slug === "en" || (slug ?? "").startsWith("en/")) === pageIsEnglish
    const eligibleFiles = allFiles.filter(
      (file) =>
        sameLang(file.slug) &&
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

    // 英文页把三个自定义标签换成英文（这几个是本站独有词，不在 i18n locale 里）
    const labels = pageIsEnglish
      ? { recent: "Recent", random: "Wander", refresh: "Shuffle", refreshAria: "Shuffle notes" }
      : { recent: "最新", random: opts.title, refresh: "换一批", refreshAria: "刷新随机笔记" }

    const initial = [...eligibleFiles].sort(() => Math.random() - 0.5).slice(0, opts.limit)

    const recentFiles = allFiles
      .filter((file) => {
        if (!file.slug || file.slug.endsWith("index") || !file.frontmatter?.title) return false
        if (!sameLang(file.slug)) return false
        if ((file.frontmatter?.tags || []).includes("movies")) return false
        const slug = file.slug
        if (opts.excludeSlugs.includes(slug)) return false
        return !opts.excludeFolders.some((prefix) => slug.startsWith(prefix))
      })
      .map((file) => ({
        file,
        ts: noteTimestamp(file),
      }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, opts.recentLimit)

    return (
      <div
        class={`random-notes ${displayClass ?? ""}`}
        data-random-notes
        data-slug={currentSlug}
        data-limit={String(opts.limit)}
        data-show-tags={String(opts.showTags)}
      >
        <div class="random-notes-tabs">
          <button class="tab-btn active" data-tab="recent">
            {labels.recent}
          </button>
          <button class="tab-btn" data-tab="random">
            {labels.random}
          </button>
        </div>
        <div class="tab-panel hidden" data-panel="random">
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
          <button class="refresh-button" data-refresh-random-notes aria-label={labels.refreshAria}>
            {labels.refresh}
          </button>
        </div>
        <div class="tab-panel" data-panel="recent">
          <ul class="random-notes-list">
            {recentFiles.map(({ file, ts }) => {
              const title = file.frontmatter?.title || file.slug || "Untitled"
              const dateStr = fmtDate(ts)
              return (
                <li key={file.slug}>
                  <a href={`/${file.slug}`} class="internal">
                    {title}
                    {dateStr && <span class="recent-date">{dateStr}</span>}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
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

      // Tab switching
      const tabBtns = container.querySelectorAll(".tab-btn")
      const panels = container.querySelectorAll(".tab-panel")
      tabBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          const target = btn.getAttribute("data-tab")
          tabBtns.forEach(function (b) { b.classList.remove("active") })
          panels.forEach(function (p) { p.classList.add("hidden") })
          btn.classList.add("active")
          container.querySelector('[data-panel="' + target + '"]').classList.remove("hidden")
        })
      })

      async function eligible() {
        const data = await fetchData
        var pageIsEnglish = currentSlug === "en" || currentSlug.indexOf("en/") === 0
        return Object.values(data).filter(function (d) {
          var slug = String(d.slug)
          return (
            (slug === "en" || slug.indexOf("en/") === 0) === pageIsEnglish &&
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
          tabBtns.forEach(function (btn) {
            btn.replaceWith(btn.cloneNode(true))
          })
        })
      }
    }

    document.addEventListener("nav", setupRandomNotes)
  `

  RandomNotes.css = style
  return RandomNotes
}) satisfies QuartzComponentConstructor
