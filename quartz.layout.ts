import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { FileTrieNode } from "./quartz/util/fileTrie"

// 侧栏 Explorer:把 Obsidian 库的内部目录名(带数字前缀 / 英文 / 内部词)
// 映射成读者能看懂的中文标签。只改「显示」,真实目录名和 slug 不变。
// 注意:mapFn / explorerSortFn 会被 .toString() 序列化后在浏览器端执行,
// 必须是自包含函数(不能闭包引用外部变量)。
const explorerMapFn = (node: FileTrieNode) => {
  // 中英同一棵大树、浏览器端按 en/ 前缀切根,所以标签按节点自己的 slug 分语言
  const isEnglish = node.slug === "en" || node.slug.startsWith("en/")
  const labels: Record<string, string> = isEnglish
    ? {
        "why-z": "About",
        templates: "Template Library",
        "tech-notes": "Tech Notes",
        videos: "Videos & Topics",
      }
    : {
        "why-z": "关于本站",
        templates: "模板库",
        "tech-notes": "折腾记录",
        videos: "视频与专题",
      }
  const label = labels[node.slugSegment]
  if (label) {
    node.displayName = label
  }
}

// 这些目录整棵不进侧栏(只滤「显示」,页面照常构建,站内链接/卡片墙不受影响):
// - read(原 2.Read):藏书馆/观影库卡片墙的数据源,真笔记本来就能从藏书馆卡片点进去,树里反而是噪音
// - about(原 6.about,智囊团)、topic-reading(原 8.主题阅读):按需隐藏
// 中英两棵树的节点 slugSegment 相同,一条规则通杀;"tags" 是上游默认过滤项,保留。
const explorerFilterFn = (node: FileTrieNode) =>
  !["tags", "read", "about", "topic-reading"].includes(node.slugSegment)

// 目录段经 slug-map.json 映射成英文后,纯字母序会打乱原有的 1-8 序号顺序,
// 用显式顺序表锚定;不同层级的段名互不相遇,共用一张表没问题。
// 表外节点(带 NN- 前缀的文件等)回退到数字感知的字母序。
const explorerSortFn = (a: FileTrieNode, b: FileTrieNode) => {
  if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
    const rank: Record<string, number> = {
      "why-z": 1,
      templates: 3,
      "tech-notes": 4,
      videos: 7,
      "video-notes": 1,
      "topic-notes": 2,
      "video-collection": 1,
      "topic-collection": 2,
    }
    const ra = rank[a.slugSegment]
    const rb = rank[b.slugSegment]
    if (ra !== undefined && rb !== undefined) return ra - rb
    if (ra !== undefined) return -1
    if (rb !== undefined) return 1
    return a.slugSegment.localeCompare(b.slugSegment, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  }
  return !a.isFolder && b.isFolder ? 1 : -1
}

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [Component.ScrollButtons()],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jady21a",
      // "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index" && page.fileData.slug !== "en/index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
    // Component.ContentMeta(), // 显示元数据
    Component.BookInfo(),  // 添加这一行,显示书籍元数据
    Component.MovieInfo(),  // 添加这一行,显示电影元数据

  ],
  left: [
    Component.PageTitle(),
    Component.Flex({
      components: [
        {
          Component: Component.SocialLinks({
            links: {
              github: "https://github.com/jady21a",
              youtube: "https://www.youtube.com/@jzzxcvbnm",
              bilibili: "https://space.bilibili.com/627566838",
              xiaohongshu: "https://www.xiaohongshu.com/user/profile/6056c994000000000101d876",
              rss: "/index.xml",
            },
          }),
          grow: true,
          align: "center",
        },
        { Component: Component.LanguageSwitch(), align: "center" },
      ],
      gap: "0",
    }),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        // { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({ mapFn: explorerMapFn, sortFn: explorerSortFn, filterFn: explorerFilterFn }),

    //Component.Graph(),
  ],
  right: [


    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),

    Component.RandomNotes({
      title: "漫步笔记",  // 可自定义标题
      limit: 3,           // 显示数量
      showTags: false,     // 是否显示标签
    }),

    // Component.Graph(),

  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.Flex({
      components: [
        {
          Component: Component.SocialLinks({
            links: {
              github: "https://github.com/jady21a",
              youtube: "https://www.youtube.com/@jzzxcvbnm",
              bilibili: "https://space.bilibili.com/627566838",
              xiaohongshu: "https://www.xiaohongshu.com/user/profile/6056c994000000000101d876",
              rss: "/index.xml",
            },
          }),
          grow: true,
          align: "center",
        },
        { Component: Component.LanguageSwitch(), align: "center" },
      ],
      gap: "0",
    }),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({ mapFn: explorerMapFn, sortFn: explorerSortFn, filterFn: explorerFilterFn }),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
    Component.RandomNotes({
      title: "漫步笔记",
      limit: 3,
      showTags: false,
    }),
  ],
}
