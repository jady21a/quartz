import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const MovieInfo: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const fm = fileData.frontmatter
  
  if (!fm) return null
  
  // 严格判断：只显示 tags 包含 "movie" 的页面
  const isMovie = fm.tags && Array.isArray(fm.tags) && fm.tags.includes('movies')
  
  // 如果不是电影页面,不显示任何内容
  if (!isMovie) return null
  
  const getImageUrl = (url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`
    }
    return url
  }
  
  return (
    <div class="movie-meta">
      <h3>🎬 电影信息</h3>
      
      <div class="movie-main">
        {/* 左侧：海报图片 */}
        {fm.封面 && typeof fm.封面 === 'string' && (
          <div class="movie-picture">
            <img 
              src={getImageUrl(fm.封面)} 
              alt={(fm.title as string) || "电影海报"}
              loading="lazy"
            />
          </div>
        )}
        
        {/* 右侧：电影信息 */}
        <div class="movie-content">
          {/* 基本信息 */}
          <div class="movie-section">
            {fm.title && (
              <p><strong>片名：</strong>{String(fm.title)}</p>
            )}
            {fm.originalTitle && (
              <p><strong>原标题：</strong>{String(fm.originalTitle)}</p>
            )}
            
            {/* 评分信息 */}
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
            
            {fm.director && (
              <p><strong>导演：</strong>{String(fm.director)}</p>
            )}
            {/* {fm.actor && (
              <p><strong>主演：</strong>{String(fm.actor)}</p>
            )} */}
            {fm.genre && (
              <p><strong>类型：</strong>{String(fm.genre)}</p>
            )}
            {fm.releaseDate && (
              <p><strong>上映日期：</strong>{String(fm.releaseDate)}</p>
            )}
            {fm.yearPublished && (
              <p><strong>年份：</strong>{String(fm.yearPublished)}</p>
            )}
            {fm.duration && (
              <p><strong>片长：</strong>{String(fm.duration)}</p>
            )}
            {fm.country && (
              <p><strong>制片国家/地区：</strong>{String(fm.country)}</p>
            )}
            {fm.language && (
              <p><strong>语言：</strong>{String(fm.language)}</p>
            )}
          </div>
          
          {/* 观看进度 */}
          <div class="movie-section">
            {fm.观看状态 && Array.isArray(fm.观看状态) && fm.观看状态.length > 0 && (
              <p><strong>观看状态：</strong>{fm.观看状态.join(", ")}</p>
            )}
            {fm.添加时间 && (
              <p><strong>添加时间：</strong>{String(fm.添加时间)}</p>
            )}
            {fm.观看日期 && (
              <p><strong>观看日期：</strong>{String(fm.观看日期)}</p>
            )}
          </div>
        </div>
      </div>
      
      {/* 简介 - 单独一行,可展开 */}
      {fm.desc && (
        <details open class="movie-description">
          <summary><strong>简介：</strong></summary>
          <div class="desc-content">{String(fm.desc)}</div>
        </details>
      )}
    </div>
  )
}

MovieInfo.displayName = "MovieInfo"

export default (() => MovieInfo) satisfies QuartzComponentConstructor