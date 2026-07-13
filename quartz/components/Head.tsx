import { i18n } from "../i18n"
import { localeForSlug } from "../util/locale"
import { FullSlug, getFileExtension, joinSegments, pathToRoot, simplifySlug } from "../util/path"
import { CSSResourceToStyleElement, JSResourceToScriptElement } from "../util/resources"
import { googleFontHref, googleFontSubsetHref } from "../util/theme"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { unescapeHTML } from "../util/escape"
import { CustomOgImagesEmitterName } from "../plugins/emitters/ogImage"
export default (() => {
  const Head: QuartzComponent = ({
    cfg,
    fileData,
    externalResources,
    ctx,
  }: QuartzComponentProps) => {
    const locale = localeForSlug(fileData.slug, cfg.locale)
    const titleSuffix = cfg.pageTitleSuffix ?? ""
    const baseTitle = fileData.frontmatter?.title ?? i18n(locale).propertyDefaults.title
    // 标题本身已含站名时不再追加后缀,避免出现 "Why Z's Notes · Why Z"
    const title = baseTitle.includes(titleSuffix.replace(/^[\s·|–—-]+/, ""))
      ? baseTitle
      : baseTitle + titleSuffix
    const description =
      fileData.frontmatter?.socialDescription ??
      fileData.frontmatter?.description ??
      unescapeHTML(fileData.description?.trim() ?? i18n(locale).propertyDefaults.description)

    const { css, js, additionalHead } = externalResources

    const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
    const path = url.pathname as FullSlug
    const baseDir = fileData.slug === "404" ? path : pathToRoot(fileData.slug!)
    const iconPath = joinSegments(baseDir, "icon2.PNG")

    // Url of current page
    const socialUrl =
      fileData.slug === "404" ? url.toString() : joinSegments(url.toString(), fileData.slug!)

    const usesCustomOgImage = ctx.cfg.plugins.emitters.some(
      (e) => e.name === CustomOgImagesEmitterName,
    )
    const ogImageDefaultPath = `https://${cfg.baseUrl}/og-image.png`

    // Only load the book/movie/video gallery assets on pages that actually use
    // them (detected by the GalleryAssets transformer), instead of on every page.
    const usesBookGallery = fileData.usesBookGallery ?? false
    const usesMovieGallery = fileData.usesMovieGallery ?? false
    const usesVideoQuery = fileData.usesVideoQuery ?? false
    const usesImageQuery = fileData.usesImageQuery ?? false

    // 访问量计数(busuanzi)总开关:访客看的部分暂不上线。false=不加载 busuanzi.js →
    // SSR 的计数 span 一直是 hidden、不显示、不请求后端(不计数)。想上线时改成 true 再 push。
    const enableBusuanzi = false
    const usesVideoPlayer = fileData.usesVideoPlayer ?? false
    // 图文卡片复用视频卡样式，因此用到 data-image-query 的页面也要加载 video-styles.css
    const usesVideoStyles = usesVideoQuery || usesImageQuery || usesVideoPlayer

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        {/* <meta name="google-site-verification" content="fGQy-3snYWezly1srxGr5NGIEEWSkVoQG7YkI7-eqTg" /> */}
        {cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" />
            <link rel="stylesheet" href={googleFontHref(cfg.theme)} />
            {cfg.theme.typography.title && (
              <link rel="stylesheet" href={googleFontSubsetHref(cfg.theme, cfg.pageTitle)} />
            )}
          </>
        )}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta name="og:site_name" content={cfg.pageTitle}></meta>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta property="og:description" content={description} />
        <meta property="og:image:alt" content={description} />

        {!usesCustomOgImage && (
          <>
            <meta property="og:image" content={ogImageDefaultPath} />
            <meta property="og:image:url" content={ogImageDefaultPath} />
            <meta name="twitter:image" content={ogImageDefaultPath} />
            <meta
              property="og:image:type"
              content={`image/${getFileExtension(ogImageDefaultPath) ?? "png"}`}
            />
          </>
        )}

        {cfg.baseUrl && (
          <>
            <meta property="twitter:domain" content={cfg.baseUrl}></meta>
            <meta property="og:url" content={socialUrl}></meta>
            <meta property="twitter:url" content={socialUrl}></meta>
          </>
        )}
        {/* 规范 URL 一律指向正式域名,旧域名 jz-quartz.pages.dev 上的同内容页由此归并 */}
        {cfg.baseUrl && fileData.slug !== "404" && (
          <link rel="canonical" href={new URL(simplifySlug(fileData.slug!), url).toString()} />
        )}

        <link rel="icon" href={iconPath} />
        <meta name="description" content={description} />
        <meta name="generator" content="Quartz" />

        {css.map((resource) => CSSResourceToStyleElement(resource, true))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
        {additionalHead.map((resource) => {
          if (typeof resource === "function") {
            return resource(fileData)
          } else {
            return resource
          }
        })}

        {/* 图书/影视/视频卡片样式：仅在用到的页面加载（<link> 在 SPA 导航时也会随 head 生效）。
            另外为封面/缩略图所在的外部源加 preconnect，提前热连接、加快首图加载。 */}
        {(usesBookGallery || usesMovieGallery) && (
          <>
            <link rel="stylesheet" href="/gallery-card.css" />
            <link rel="preconnect" href="https://images.weserv.nl" />
          </>
        )}
        {usesVideoStyles && <link rel="stylesheet" href="/video-styles.css" />}
        {/*
          视频合集/列表页(data-video-query):用户几乎必然会点卡片进详情页,而合集页本身
          不加载 lite-youtube。提前 prefetch 脚本/样式,点进详情时就是缓存命中、<lite-youtube>
          立即 define,消除「从合集点进详情、YouTube 源加载不出来」的空白窗口。用 prefetch
          而非 preload:本页不消费这些资源,preload 会触发「预载未使用」告警;prefetch 正是
          「为下一次导航预取」的语义,且自定义元素注册表在 SPA 导航间常驻,预热一次即长期受益。
        */}
        {usesVideoQuery && (
          <>
            <link rel="preconnect" href="https://i.ytimg.com" />
            <link rel="prefetch" as="script" href="/lite-yt-embed.js" />
            <link rel="prefetch" as="style" href="/lite-yt-embed.css" />
          </>
        )}
        {/*
          播放器页面(usesVideoPlayer)：
          - lite-yt-embed.css 必须作为常驻 <link rel=stylesheet> SSR 进本页 head。
            它给 <lite-youtube> 撑起 16:9 尺寸;若靠 video-player.js 运行时注入,SPA 导航
            会把非 spa-preserve 的 head 元素全清掉(spa.inline.ts 的 head 补丁),而
            __liteYoutubeLoaded 标记又拦住重新注入 → 详情页互跳后样式丢失、播放器塌成 20px、
            「不刷新就加载不出来」。SSR 进本页 head 后,每次导航 head 补丁都会重新补上,稳。
          - lite-yt-embed.js 只 preload 预热:自定义元素注册表在 SPA 导航间常驻,首访由
            video-player.js 运行时注入并 define,之后一直有效,故脚本不需要常驻、只预取加速。
        */}
        {usesVideoPlayer && (
          <>
            <link rel="stylesheet" href="/lite-yt-embed.css" />
            <link rel="preload" as="script" href="/lite-yt-embed.js" />
            <link rel="preconnect" href="https://i.ytimg.com" />
          </>
        )}
        {/*
          渲染脚本必须全局常驻：SPA 导航时新注入到 <head> 的 <script> 不会执行，
          需要它们在首次整页加载时绑定 nav 事件来驱动后续渲染。两个脚本在页面没有
          对应容器时会直接返回、按需抓取 index.json；lite-youtube CDN 也由
          video-player.js 在检测到播放器时动态注入，因此普通页面不会加载它。
        */}
        <script src="/gallery.js" defer></script>
        <script src="/video-player.js" defer></script>
        {/* 访问量计数:全站常驻,绑定 nav 事件后驱动每次页面/导航的计数上报与显示。
            由 enableBusuanzi 总开关控制,暂不上线(见上方常量)。 */}
        {enableBusuanzi && <script src="/busuanzi.js" defer></script>}
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
