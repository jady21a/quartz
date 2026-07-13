---
title:
  - 010-Obsidian homepage
tags:
  - video
  - obsidian
videoid: https://youtu.be/NG5vwZffKlY
bilibiliid: 【我的 Obsidian 首页搭建：5 个模块 + 动态显示】 https://www.bilibili.com/video/BV1btEi6vEtz/?share_source=copy_web&vd_source=0301e644f5fde063fd132a7c560992cb
cover: https://i2.hdslb.com/bfs/archive/f94d58f9ffdeb62548a2741ccd77d3c59bc8b662.jpg
defaultSource: bilibili
date: 2026-06-11
category: obsidian
---

<div class="video-player-container" data-title="obsidian homepage"></div>

## 我的 Obsidian 首页搭建：5 个模块 + 动态显示

相关代码:[[002-1homepage template]]  [[002-2homepage-dashboard]]

```text
00:00 引言
00:40 homepage 展示
00:46 快捷操作
01:14 快速导航
02:10 常用项目
02:24 常用模板 + 热力图
03:13 如何实现
05:05 结尾
```

# homepage content
## 引言
我们用 Obsidian 做笔记，经常要快速记录灵感，但页面散在各处。即使文件已经按分类整理好了，找到对应的文件还是要花时间——等找到了，可能已经忘了想记什么。

我试过把所有常用链接堆在一个页面里，但 list 太长，每次要滑半天；也试过书签，比清单好一点，但依然不够直观。网上各种 homepage 方案我也看过，没有完全符合我需求的，所以自己做了一个。需求其实很简单：**动态显示 + 简洁明了**，核心就一件事——减少记录摩擦。


---

## 如何搭建homepage

### 插件

| 插件                     | 作用                                  |
| ---------------------- | ----------------------------------- |
| **Homepage**           | 让 Obsidian 每次打开自动跳到指定页面             |
| **Dataview**           | 动态查询笔记、生成列表（需打开 JavaScript Queries） |
| **Templater**          | 配合快捷操作按钮，一键新建笔记                     |
| **Contribution Graph** | 活跃度热力图                              |
| **Obsidian ECharts**   | 字数热力图                               |

### CSS snippet

- **[MCL Multi Column](https://github.com/efemkay/obsidian-modular-css-layout)**：实现多栏卡片布局。它不是插件，从 GitHub 下载 `MCL Multi Column.css`，放到 `.obsidian/snippets` 文件夹，再到 `设置 → 外观 → CSS 代码片段` 里打开。
- 另外还有一份我自己写的 [[002-2homepage-dashboard|homepage-columns.css]]，负责给按钮和卡片加圆角、阴影、配色，并做深浅主题自适应。

 把[[002-2homepage-dashboard]]存成 `.obsidian/snippets/homepage-columns.css`，在 `设置 → 外观 → CSS 代码片段` 里打开即可。因为前面 frontmatter 挂了 `cssclasses: homepage-dashboard`，所有样式都只作用于这一页，不会污染其它笔记。


---
## 新建homepage.md
复制粘贴[[002-1homepage template]]
安装好插件和css代码之后,把链接改为自己的页面即可


## 装插件和css代码

装好 **Homepage** 插件后，在它的设置里：

1. 把 `homepage`（这个文件）设为首页；
2. 打开 **Pin homepage**——这样首页不会被其他笔记覆盖；
3. 打开 **Open in reading view**——每次以阅读模式展示。

这样每次打开 Obsidian，就会自动以阅读模式停在这个仪表盘页面。

> [!warning] 别忘了
> 在 Dataview 设置里打开 **Enable JavaScript Queries**，否则下面的 `dataviewjs` 按钮和字数热力图都不会渲染。

---

## homepage主要模块
- 快捷操作
- 快速导航
- 常用项目
- 常用模板
- 热力图

---

## 小结

整个首页就是 **Markdown 文件 + 插件 + 一段 CSS** 的组合：

- **Homepage** 负责"打开就停在这一页"；
- **Dataviewjs 按钮 + Templater** 把高频操作收进一排按钮；
- **multi-column callout** 把链接分场景排成卡片；
- **Dataview / Tasks** 让"最近笔记""今日任务"自动更新，零维护；
- **两张热力图** 用文件数和字数双重视角，看清持续输出的节奏；
- **一段作用域 CSS** 统一外观，并自动适配深浅主题。

没有用任何主题私有接口，换主题也不会坏。把上面的代码按你自己的目录、模板和常用页面改一改，就能搭出一份属于你自己的首页。


# 补充
## 视频补充 
### css
视频中漏说了一个[[002-2homepage-dashboard|css代码]]，在本文中已经补充，见 [[#CSS snippet]]

### 插件:
- Better Word Count——记录每天字数
字数热力图需要用到这个插件来统计字数

## obsidian-echarts插件下架问题

视频里字数热力图用的是 **Obsidian ECharts** 插件，但它已经从社区商店下架了——现在搜不到、没法一键安装。可能是仓库长期无更新/维护, 官方把仓库从目录里清掉了。

有两个解法：
### 方案一：去 GitHub 手动安装原插件

原仓库还在：[cumany/obsidian-echarts](https://github.com/cumany/obsidian-echarts)。

1. 从仓库的 Releases（或源码）下载 `main.js` 和 `manifest.json`；
2. 在你的库里新建文件夹 `.obsidian/plugins/obsidian-echarts/`，把这两个文件放进去；
3. 重启 Obsidian，到 `设置 → 第三方插件` 里启用它。

优点：直接显示视频中的字数热力图效果。缺点：插件已不维护，未来 Obsidian 升级有可能不兼容。

### 方案二：改用 Contribution Graph

其实**字数热力图和活跃度热力图可以共用同一个插件**——**Contribution Graph**

新的homepage[[002-1homepage template]]保留了3个热力图,对比效果图放这里，大家按需选择：


![[Pasted image 20260612182850.png]]


## 目录结构
有小伙伴说想看看目录结构,放这里了
![[Pasted image 20260612110005.png]]