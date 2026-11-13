import fs from "fs"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative, simplifySlug } from "../util/path"
import { classNames } from "../util/lang"

// 模板页顶部说明:这是什么模板、哪期视频讲过、怎么拿走。
// 模板正文每次发布都从主库 10.Template 整份覆盖,说明写不进 md,只能由组件补。
// - 一句话简介:取自模板库首页(templates/index)卡片上的 item-desc,只维护那一处
// - 配套讲解:自动找出链到本页的视频页
const TEMPLATE = /^(en\/)?templates\/(?!.*(^|\/)index$).+/
const CARD =
  /<a[^>]*href="([^"]+)"[^>]*>\s*<span class="item-title">[^<]*<\/span>\s*<span class="item-desc">([^<]*)<\/span>/g

// 模板库首页一次构建只读一遍
const descCache = new Map<string, Map<string, string>>()
function descriptions(indexPath: string): Map<string, string> {
  let table = descCache.get(indexPath)
  if (!table) {
    table = new Map()
    try {
      const raw = fs.readFileSync(indexPath, "utf-8")
      for (const m of raw.matchAll(CARD)) {
        table.set(decodeURI(m[1]).replace(/^\//, ""), m[2].trim())
      }
    } catch {}
    descCache.set(indexPath, table)
  }
  return table
}

const TemplateIntro: QuartzComponent = ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug!
  if (!TEMPLATE.test(slug)) return null
  const isEn = slug.startsWith("en/")

  const index = allFiles.find((f) => f.slug === (isEn ? "en/templates/index" : "templates/index"))
  const desc = index?.filePath ? descriptions(index.filePath).get(slug) : undefined

  const self = simplifySlug(slug)
  const videos = allFiles
    .filter(
      (f) =>
        f.slug &&
        /^(en\/)?videos\/video-notes\/(?!index$)/.test(f.slug) &&
        f.slug.startsWith("en/") === isEn &&
        (f.links ?? []).includes(self),
    )
    .sort((a, b) => a.slug!.localeCompare(b.slug!, undefined, { numeric: true }))

  if (!desc && videos.length === 0) return null

  return (
    <div class={classNames(displayClass, "template-intro")}>
      {desc && <p>{desc}</p>}
      {videos.length > 0 && (
        <p>
          {isEn ? "Explained in: " : "配套讲解:"}
          {videos.map((v, k) => (
            <>
              {k > 0 && (isEn ? ", " : "、")}
              <a class="internal" href={resolveRelative(slug, v.slug!)}>
                {v.frontmatter?.title}
              </a>
            </>
          ))}
        </p>
      )}
      <p class="template-intro-hint">
        {isEn
          ? "To use it: click the copy button at the top right of the code block and paste it into your Obsidian templates folder."
          : "用法:点代码框右上角的复制按钮,粘贴到你的 Obsidian 模板文件夹。"}
      </p>
    </div>
  )
}

TemplateIntro.css = `
.template-intro {
  margin: 1rem 0 0;
  padding: 0.7rem 1rem;
  border: 1px solid var(--lightgray);
  border-left: 3px solid var(--secondary);
  border-radius: 6px;
  background: var(--light);
  font-size: 0.95rem;
}
.template-intro p {
  margin: 0.2rem 0;
}
.template-intro .template-intro-hint {
  color: var(--gray);
  font-size: 0.85rem;
}
`

export default (() => TemplateIntro) satisfies QuartzComponentConstructor
