import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

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
    Component.Explorer(),

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
    Component.Explorer(),
  ],
  right: [],
}
