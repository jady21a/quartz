import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps, useQuartz } from "./types"
import style from "./styles/randomNotesSidebar.scss"

export default (() => {
  const RandomNotesSidebar: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const { pages } = useQuartz() // 获取所有页面
    if (!pages || pages.length === 0) return null

    const shuffled = [...pages].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, 3)

    return (
      <aside class={`${displayClass ?? ""} random-notes-sidebar`}>
        <h3>随机漫步笔记</h3>
        <ul>
          {selected.map(page => (
            <li key={page.path}>
              <a href={page.path}>{page.title || page.path}</a>
            </li>
          ))}
        </ul>
      </aside>
    )
  }

  RandomNotesSidebar.css = style
  return RandomNotesSidebar
}) satisfies QuartzComponentConstructor
