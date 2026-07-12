import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"
import { QuartzPluginData } from "./quartz/plugins/vfile"
import { isFolderPath } from "./quartz/util/path"

// 文件夹页列表排序：子文件夹在前,其余按标题降序(numeric 让 "10" 排在 "9" 后面,
// 编号笔记如 011-xxx 能按序号新→旧排列,而不是按修改日期乱跳)
const byTitleDescFolderFirst = (f1: QuartzPluginData, f2: QuartzPluginData): number => {
  const f1IsFolder = isFolderPath(f1.slug ?? "")
  const f2IsFolder = isFolderPath(f2.slug ?? "")
  if (f1IsFolder && !f2IsFolder) return -1
  if (!f1IsFolder && f2IsFolder) return 1

  const f1Title = f1.frontmatter?.title?.toLowerCase() ?? ""
  const f2Title = f2.frontmatter?.title?.toLowerCase() ?? ""
  return f2Title.localeCompare(f1Title, "zh-CN", { numeric: true })
}

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Why Z",
    pageTitleSuffix: " · Why Z",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "zh-CN",
    baseUrl: "jz21.eu.org",
    // 英文翻译暂不发布：默认构建(线上 Cloudflare 用的就是 `npx quartz build`)跳过 en/。
    // 本地预览英文版时加环境变量：SHOW_EN=1 npx quartz build --serve
    // 3.Template/content-template 是本库自用的 Templater 活模板（new-video/new-topic），只在 Obsidian 用，不上站
    ignorePatterns: ["private", "templates", ".obsidian", "3.Template/content-template", "3.Template/content-template/**", ...(process.env.SHOW_EN ? [] : ["en", "en/**"])],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Schibsted Grotesk",
        body: "Source Sans Pro",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#faf8f8",
          lightgray: "#e5e5e5",
          gray: "#b8b8b8",
          darkgray: "#4e4e4e",
          dark: "#2b2b2b",
          secondary: "#284b63",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#161618",
          lightgray: "#393639",
          gray: "#646464",
          darkgray: "#d4d4d4",
          dark: "#ebebec",
          secondary: "#7b97aa",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },

  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.GalleryAssets(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({
        enableInHtmlEmbed: false,

        //尝试去掉空格
        mermaid: true,
        callouts: true,
        comments: true,
      }),
      Plugin.GitHubFlavoredMarkdown({
        //空格尝试
        // breaks:true,
      }),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage({ sort: byTitleDescFolderFirst }),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
        // 与侧栏「最新」(RandomNotes)同一套排除规则;另排除 en/ 英文镜像,避免中英重复条目
        rssExcludeFolders: [
          ".trash",
          "1.",
          "2.Read/dataview",
          "2.Read/douban",
          "2.Read/media-DB",
          "3.",
          "en/",
        ],
        rssExcludeSlugs: ["藏书馆", "观影库", "7.shared/专题合集", "7.shared/视频合集"],
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // CustomOgImages 已关闭以加快构建：社交分享图回退到默认 /og-image.png
      // Plugin.CustomOgImages(),

      // Plugin.Sitemap(), // 确保启用 Sitemap
    ],
  },
}

export default config
