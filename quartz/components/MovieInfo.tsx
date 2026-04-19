import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveCoverUrl } from "../util/coverImage"

const movieTags = new Set(["movies", "movie", "teleplay", "tv", "电影", "电视剧"])

const MovieInfo: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const fm = fileData.frontmatter
  
  if (!fm) return null
  
  const isMovie =
    fm.tags &&
    Array.isArray(fm.tags) &&
    fm.tags.some((t) => movieTags.has(String(t).toLowerCase()))
  
  if (!isMovie) return null

  const coverSrc = resolveCoverUrl(fm.封面, fm as Record<string, unknown>, fileData.relativePath, "movie")
  
  return (
    <div class="movie-meta">
      <h3>🎬 电影信息</h3>
      
      <div class="movie-main">
        {/* 左侧：海报图片 */}
        {coverSrc && (
          <div class="movie-picture">
            <img 
              src={coverSrc} 
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
             {fm.aliases && (
              <p><strong>别名：</strong>{String(fm.aliases)}</p>
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
            {fm.state && Array.isArray(fm.state) && fm.state.length > 0 && (
              <p><strong>观看状态：</strong>{fm.state.join(", ")}</p>
            )}
            {fm.添加时间 && (
              <p><strong>添加时间：</strong>{String(fm.添加时间)}</p>
            )}
            {fm.结束时间 && (
              <p><strong>结束时间：</strong>{String(fm.结束时间)}</p>
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