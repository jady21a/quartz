import Content from "./pages/Content"
import TagContent from "./pages/TagContent"
import FolderContent from "./pages/FolderContent"
import NotFound from "./pages/404"
import ArticleTitle from "./ArticleTitle"
import Darkmode from "./Darkmode"
import ReaderMode from "./ReaderMode"
import Head from "./Head"
import PageTitle from "./PageTitle"
import ContentMeta from "./ContentMeta"
import Spacer from "./Spacer"
import TableOfContents from "./TableOfContents"
import Explorer from "./Explorer"
import TagList from "./TagList"
import Graph from "./Graph"
import Backlinks from "./Backlinks"
import Search from "./Search"
import Footer from "./Footer"
import DesktopOnly from "./DesktopOnly"
import MobileOnly from "./MobileOnly"
import RecentNotes from "./RecentNotes"
import Breadcrumbs from "./Breadcrumbs"
import Flex from "./Flex"
import ConditionalRender from "./ConditionalRender"
import LanguageSwitch from "./LanguageSwitch"
import SocialLinks from "./SocialLinks"

import mediaInfo from "./MediaInfo"

// 书籍 / 影视详情页的信息卡片（由同一个 MediaInfo 实现）
const BookInfo = mediaInfo("book")
const MovieInfo = mediaInfo("movie")

export { default as RandomNotes } from "./RandomNotes"

export {
  ArticleTitle,
  Content,
  TagContent,
  FolderContent,
  Darkmode,
  ReaderMode,
  Head,
  PageTitle,
  ContentMeta,
  Spacer,
  TableOfContents,
  Explorer,
  TagList,
  Graph,
  Backlinks,
  Search,
  Footer,
  DesktopOnly,
  MobileOnly,
  RecentNotes,
  NotFound,
  Breadcrumbs,
  Flex,
  ConditionalRender,
  LanguageSwitch, // 中英语言切换
  SocialLinks, // “Why Z” 下方的社交平台图标
  BookInfo, // 添加这一行,书籍元数据显示
  MovieInfo,
}
