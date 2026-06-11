import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { getDate } from "./Date"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import style from "./styles/randomNotes.scss"

// Map of note relativePath -> creation timestamp (ms), used by the "最新" tab.
//
// Prefer the precomputed manifest (scripts/generate-created-dates.js). Building
// it from git at runtime breaks on Cloudflare Pages because Pages shallow-clones
// the repo, so `git log --diff-filter=A` can't see when notes were first added
// and the "最新" order collapses. The committed manifest carries the full-history
// dates, so the deployed site stays correct. Fall back to git for local dev when
// the manifest is missing.
function loadCreatedMap(): Map<string, number> {
  const manifestPath = path.join(process.cwd(), "quartz", "static", "created-dates.json")
  try {
    const obj = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Record<string, number>
    return new Map(Object.entries(obj).map(([k, v]) => [k, Number(v)]))
  } catch {}
  return buildGitCreatedMap()
}

function buildGitCreatedMap(): Map<string, number> {
  const map = new Map<string, number>()
  try {
    const raw = execSync(
      'git -c core.quotePath=false log --diff-filter=A --pretty="format:%at" --name-only -- content/',
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    )
    let currentTs = 0
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/^\d+$/.test(trimmed)) {
        currentTs = parseInt(trimmed, 10) * 1000
      } else if (currentTs && trimmed.startsWith("content/")) {
        const rel = trimmed.slice("content/".length)
        if (!map.has(rel)) {
          map.set(rel, currentTs)
        }
      }
    }
  } catch {}
  return map
}

const gitDateMap = loadCreatedMap()

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
    cfg,
  }: QuartzComponentProps) => {
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

    const initial = [...eligibleFiles].sort(() => Math.random() - 0.5).slice(0, opts.limit)

    const recentFiles = allFiles
      .filter((file) => {
        if (!file.slug || file.slug.endsWith("index") || !file.frontmatter?.title) return false
        if ((file.frontmatter?.tags || []).includes("movies")) return false
        const slug = file.slug
        if (opts.excludeSlugs.includes(slug)) return false
        return !opts.excludeFolders.some((prefix) => slug.startsWith(prefix))
      })
      .map((file) => ({
        file,
        gitDate: gitDateMap.get(file.relativePath!) ?? 0,
      }))
      .sort((a, b) => b.gitDate - a.gitDate)
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
            最新
          </button>
          <button class="tab-btn" data-tab="random">
            {opts.title}
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
          <button class="refresh-button" data-refresh-random-notes aria-label="刷新随机笔记">
            换一批
          </button>
        </div>
        <div class="tab-panel" data-panel="recent">
          <ul class="random-notes-list">
            {recentFiles.map(({ file, gitDate }) => {
              const title = file.frontmatter?.title || file.slug || "Untitled"
              const date = gitDate ? new Date(gitDate) : null
              return (
                <li key={file.slug}>
                  <a href={`/${file.slug}`} class="internal">
                    {title}
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
