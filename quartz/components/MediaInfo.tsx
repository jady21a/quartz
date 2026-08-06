import { QuartzComponent, QuartzComponentProps } from "./types"
import { resolveCoverUrl } from "../util/coverImage"

// Shared implementation for the book / movie detail-page info cards. The two
// used to be near-identical components (BookInfo / MovieInfo); this keeps a
// single renderer and only varies the fields, labels and styling prefix.
export type MediaKind = "book" | "movie"

type Fm = Record<string, any>
interface Row {
  label: string
  value: string | null
}

interface MediaConfig {
  displayName: string
  heading: string
  prefix: string
  coverAlt: string
  matches: (tags: any[]) => boolean
  before: (fm: Fm) => Row[]
  after: (fm: Fm) => Row[]
  section2: (fm: Fm) => Row[]
  descOpen: boolean
}

const movieTags = new Set(["movies", "movie", "teleplay", "tv", "电影", "电视剧"])

const str = (v: any): string | null => {
  if (v === undefined || v === null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}
const list = (v: any): string | null => (Array.isArray(v) && v.length > 0 ? v.join(", ") : null)

const configs: Record<MediaKind, MediaConfig> = {
  book: {
    displayName: "BookInfo",
    heading: "📚 书籍信息",
    prefix: "book",
    coverAlt: "书籍封面",
    matches: (tags) => tags.includes("book"),
    before: (fm) => [
      { label: "书名", value: str(fm.title) },
      { label: "原书名", value: str(fm.originalTitle) },
      { label: "中文书名", value: str(fm.CNTitle) },
    ],
    after: (fm) => [
      { label: "作者", value: str(fm.author) },
      { label: "出版", value: str(fm.publishDate) },
      { label: "出版年份", value: str(fm.yearPublished) },
      { label: "总页数", value: str(fm.totalPage) },
    ],
    section2: (fm) => [
      { label: "阅读状态", value: list(fm.阅读状态) },
      { label: "当前页码", value: str(fm.currentPage) },
      { label: "阅读进度", value: str(fm.阅读进度) },
      { label: "添加时间", value: str(fm.添加时间) },
      { label: "开始阅读", value: str(fm.开始阅读) },
      { label: "结束阅读", value: str(fm.结束阅读) },
    ],
    descOpen: false,
  },
  movie: {
    displayName: "MovieInfo",
    heading: "🎬 电影信息",
    prefix: "movie",
    coverAlt: "电影海报",
    matches: (tags) => tags.some((t) => movieTags.has(String(t).toLowerCase())),
    before: (fm) => [
      { label: "片名", value: str(fm.title) },
      { label: "原标题", value: str(fm.originalTitle) },
    ],
    after: (fm) => [
      { label: "导演", value: str(fm.director) },
      { label: "别名", value: str(fm.aliases) },
      { label: "类型", value: str(fm.genre) },
      { label: "上映日期", value: str(fm.releaseDate) },
      { label: "年份", value: str(fm.yearPublished) },
      { label: "片长", value: str(fm.duration) },
      { label: "制片国家/地区", value: str(fm.country) },
      { label: "语言", value: str(fm.language) },
    ],
    section2: (fm) => [
      { label: "观看状态", value: list(fm.state) },
      { label: "添加时间", value: str(fm.添加时间) },
      { label: "结束时间", value: str(fm.结束时间) },
    ],
    descOpen: true,
  },
}

const Rows = ({ rows }: { rows: Row[] }) => (
  <>
    {rows.map((r) =>
      r.value ? (
        <p key={r.label}>
          <strong>{r.label}：</strong>
          {r.value}
        </p>
      ) : null,
    )}
  </>
)

// 返回类型写成 `() => QuartzComponent` 而不是 `QuartzComponentConstructor`:
// 后者展开是 `(opts: Options) => QuartzComponent`,Options 默认 undefined 时那个参数
// 仍然是**必填**的(类型为 undefined 的必填参数),于是 layout 里 `Component.BookInfo()`
// 会报 TS2554「Expected 1 arguments, but got 0」。
// 其他组件没事是因为它们用的是 `satisfies QuartzComponentConstructor` —— satisfies 只做
// 可赋值性检查,函数自身推断出的类型仍是零参数。这里是显式返回类型标注,直接把签名锁死了。
export default function mediaInfo(kind: MediaKind): () => QuartzComponent {
  const cfg = configs[kind]

  return () => {
    const MediaInfo: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
      const fm = fileData.frontmatter as Fm | undefined
      if (!fm) return null

      const tags = Array.isArray(fm.tags) ? fm.tags : null
      if (!tags || !cfg.matches(tags)) return null

      const coverSrc = resolveCoverUrl(
        fm.封面,
        fm as Record<string, unknown>,
        fileData.relativePath,
        kind,
      )

      const p = cfg.prefix
      const hasScore = fm.scoreStar || fm.score

      return (
        <div class={`${p}-meta`}>
          <h3>{cfg.heading}</h3>

          <div class={`${p}-main`}>
            {coverSrc && (
              <div class={`${p}-picture`}>
                <img src={coverSrc} alt={str(fm.title) || cfg.coverAlt} loading="lazy" />
              </div>
            )}

            <div class={`${p}-content`}>
              <div class={`${p}-section`}>
                <Rows rows={cfg.before(fm)} />

                {hasScore && (
                  <p className="rating-line">
                    <strong>豆瓣评分：</strong>
                    {fm.scoreStar && <span className="stars">{String(fm.scoreStar)}</span>}
                    &nbsp;&nbsp;
                    {fm.score && <span className="score">{String(fm.score)}</span>}
                  </p>
                )}

                {fm.myRate && (
                  <p>
                    <strong>我的评分：</strong>
                    {String(fm.myRate)}
                  </p>
                )}

                <Rows rows={cfg.after(fm)} />
              </div>

              <div class={`${p}-section`}>
                <Rows rows={cfg.section2(fm)} />
              </div>
            </div>
          </div>

          {fm.desc && (
            <details open={cfg.descOpen} class={`${p}-description`}>
              <summary>
                <strong>简介：</strong>
              </summary>
              <div class="desc-content">{String(fm.desc)}</div>
            </details>
          )}
        </div>
      )
    }

    MediaInfo.displayName = cfg.displayName
    return MediaInfo
  }
}
