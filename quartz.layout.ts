import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { FileTrieNode } from "./quartz/util/fileTrie"

// 侧栏 Explorer:把 Obsidian 库的内部目录名(带数字前缀 / 英文 / 内部词)
// 映射成读者能看懂的中文标签。只改「显示」,真实目录名和 slug 不变。
// 注意:mapFn / explorerSortFn 会被 .toString() 序列化后在浏览器端执行,
// 必须是自包含函数(不能闭包引用外部变量)。
const explorerMapFn = (node: FileTrieNode) => {
  const labels: Record<string, string> = {
    "1.Why-Z": "关于本站",
    "2.Read": "读书笔记",
    "3.Template": "模板库",
    "4.技术记录": "技术折腾",
    "5.obsidian探索": "Obsidian 探索",
    "6.about": "智囊团",
    "7.shared": "视频与专题",
    "8.主题阅读": "主题阅读",
  }
  const label = labels[node.slugSegment]
  if (label) {
    node.displayName = label
  }
}

// 改名后若按 displayName 排序,中文标签会打乱侧栏原有的 1-8 顺序,
// 所以改按未改动的 slugSegment(仍带数字前缀)排序,保持文件夹在前、序号递增。
const explorerSortFn = (a: FileTrieNode, b: FileTrieNode) => {
  if ((!a.isFolder && !b.isFolder) || (a.isFolder && b.isFolder)) {
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
  afterBody: [],
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
    Component.SocialLinks({
      links: {
        github: "https://github.com/jady21a",
        youtube: "https://www.youtube.com/@jzzxcvbnm",
        bilibili: "https://space.bilibili.com/627566838",
        xiaohongshu: "https://www.xiaohongshu.com/user/profile/6056c994000000000101d876",
        rss: "/index.xml",
      },
    }),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.LanguageSwitch() },
        // { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({ mapFn: explorerMapFn, sortFn: explorerSortFn }),

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
    Component.SocialLinks({
      links: {
        github: "https://github.com/jady21a",
        youtube: "https://www.youtube.com/@jzzxcvbnm",
        bilibili: "https://space.bilibili.com/627566838",
        xiaohongshu: "https://www.xiaohongshu.com/user/profile/6056c994000000000101d876",
        rss: "/index.xml",
      },
    }),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.LanguageSwitch() },
      ],
    }),
    Component.Explorer({ mapFn: explorerMapFn, sortFn: explorerSortFn }),
  ],
  right: [],
}
