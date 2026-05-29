import { i18n } from "../i18n"
import { FullSlug, getFileExtension, joinSegments, pathToRoot } from "../util/path"
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
    const titleSuffix = cfg.pageTitleSuffix ?? ""
    const title =
      (fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title) + titleSuffix
    const description =
      fileData.frontmatter?.socialDescription ??
      fileData.frontmatter?.description ??
      unescapeHTML(fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description)

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
    const usesVideoPlayer = fileData.usesVideoPlayer ?? false
    const usesVideoStyles = usesVideoQuery || usesVideoPlayer

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

        {/* 图书/影视/视频卡片样式：仅在用到的页面加载（<link> 在 SPA 导航时也会随 head 生效） */}
        {usesBookGallery && <link rel="stylesheet" href="/book-styles.css" />}
        {usesMovieGallery && <link rel="stylesheet" href="/movie-styles.css" />}
        {usesVideoStyles && <link rel="stylesheet" href="/video-styles.css" />}
        {/*
          渲染脚本必须全局常驻：SPA 导航时新注入到 <head> 的 <script> 不会执行，
          需要它们在首次整页加载时绑定 nav 事件来驱动后续渲染。两个脚本在页面没有
          对应容器时会直接返回、按需抓取 index.json；lite-youtube CDN 也由
          video-player.js 在检测到播放器时动态注入，因此普通页面不会加载它。
        */}
        <script src="/gallery.js" defer></script>
        <script src="/video-player.js" defer></script>
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
