import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const BookInfo: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const fm = fileData.frontmatter
  
  if (!fm) return null
  
  // 严格判断：必须有 tags 包含 "book" 或者有书籍特定字段
  const isBook = (
    (fm.tags && Array.isArray(fm.tags) && fm.tags.includes('book')) ||
    (fm.author && (fm.score || fm.封面 || fm.publishDate))
  )
  
  // 如果不是书籍页面，不显示任何内容
  if (!isBook) return null
  
  const getImageUrl = (url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`
    }
    return url
  }
  
  return (
    <div class="book-meta">
      <h3>📚 书籍信息</h3>
      
      <div class="book-main">
        {/* 左侧：封面图片 */}
        {fm.封面 && typeof fm.封面 === 'string' && (
          <div class="book-picture">
            <img 
              src={getImageUrl(fm.封面)} 
              alt={(fm.title as string) || "书籍封面"}
              loading="lazy"
            />
          </div>
        )}
        
        {/* 右侧：书籍信息 */}
        <div class="book-content">
          {/* 基本信息 */}
          <div class="book-section">
            {fm.title && (
              <p><strong>书名：</strong>{String(fm.title)}</p>
            )}
            {fm.originalTitle && (
              <p><strong>原标题：</strong>{String(fm.originalTitle)}</p>
            )}
                      {/* 评分信息 */}
          <div class="book-section">
          {(fm.scoreStar || fm.score) && (
            <p className="rating-line">
                <strong>豆瓣评分：</strong>
                {fm.scoreStar && <span className="stars">{fm.scoreStar}</span>}
                &nbsp;&nbsp;
                {fm.score && <span className="score">{fm.score}</span>}
            </p>
            )}

            {fm.myRate && (
              <p><strong>我的评分：</strong>{String(fm.myRate)}</p>
            )}
          </div>
            {fm.author && (
              <p><strong>作者：</strong>{String(fm.author)}</p>
            )}
            {fm.publishDate && (
              <p><strong>出版：</strong>{String(fm.publishDate)}</p>
            )}
            {fm.yearPublished && (
              <p><strong>出版年份：</strong>{String(fm.yearPublished)}</p>
            )}
            {fm.totalPage && (
              <p><strong>总页数：</strong>{String(fm.totalPage)}</p>
            )}
          </div>
          

          
          {/* 阅读进度 */}
          <div class="book-section">
            {fm.阅读状态 && Array.isArray(fm.阅读状态) && fm.阅读状态.length > 0 && (
              <p><strong>阅读状态：</strong>{fm.阅读状态.join(", ")}</p>
            )}
            {fm.currentPage && (
              <p><strong>当前页码：</strong>{String(fm.currentPage)}</p>
            )}
            {fm.阅读进度 && (
              <p><strong>阅读进度：</strong>{String(fm.阅读进度)}</p>
            )}
            {fm.添加时间 && (
              <p><strong>添加时间：</strong>{String(fm.添加时间)}</p>
            )}
            {fm.开始阅读 && (
              <p><strong>开始阅读：</strong>{String(fm.开始阅读)}</p>
            )}
            {fm.结束阅读 && (
              <p><strong>结束阅读：</strong>{String(fm.结束阅读)}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* 简介 - 单独一行，可展开 */}
      {fm.desc && (
        <details class="book-description">
          <summary><strong>简介：</strong></summary>
          <div class="desc-content">{String(fm.desc)}</div>
        </details>
      )}
    </div>
  )
}

BookInfo.displayName = "BookInfo"

export default (() => BookInfo) satisfies QuartzComponentConstructor