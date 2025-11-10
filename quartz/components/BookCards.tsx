import { QuartzComponent, QuartzComponentProps } from "./types"

export default (({ allPages }: QuartzComponentProps) => {
  // 筛选出特定路径的笔记
  const books = allPages.filter(p => p.filePath?.includes("Read/douban"))

  return (
    <div class="grid grid-cols-3 gap-4">
      {books.map(page => (
        <div class="card p-3 rounded-2xl shadow">
          <img src={page.frontmatter?.封面} alt={page.frontmatter?.originalTitle} width="100" />
          <h3>{page.frontmatter?.originalTitle}</h3>
          <p>{page.frontmatter?.author}</p>
          <p>{page.frontmatter?.阅读状态}</p>
          <p>{page.frontmatter?.myRate}</p>
        </div>
      ))}
    </div>
  )
}) satisfies QuartzComponent
