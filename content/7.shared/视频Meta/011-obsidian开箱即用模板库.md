---
title:
  - 011-obsidian开箱即用模板库
tags:
  - video
videoid: https://youtu.be/ocwFtT9Vs70
bilibiliid: <iframe src="//player.bilibili.com/player.html?isOutside=true&aid=116866865432483&bvid=BV1cNTC65EQF&cid=39674711564&p=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>
cover: https://i1.hdslb.com/bfs/archive/994c7e20c40ac45f7f6ed36501f55b6fa3cd0d38.jpg
defaultSource: youtube
date: 2026-07-05
category: obsidian
---

<div class="video-player-container" data-title="obsidian开箱即用模板库"></div>

## obsidian 开箱即用模板库

00:00 引言
00:36 下载
00:57 模板库简介
02:22 快速上手：三件小事
04:04 自制插件
05:34 结语

相关代码: 👉 [obsidian-workflow-vault](https://github.com/jady21a/obsidian-workflow-vault)（GitHub 仓库，Code → Download ZIP 下载）
相关视频: [[7.shared/视频Meta/010-Obsidian homepage|主页搭建]] 、[[7.shared/视频Meta/008-项目管理|项目管理]] 、[[7.shared/视频Meta/009-一个指令，让AI 自动生成周复盘|AI 周复盘]] 、[[7.shared/视频Meta/001-自动继承昨日任务|日记任务继承]] 、[[7.shared/视频Meta/007-自建个人专属图书馆,douban图片链接失效怎么办|个人图书馆]]

---

## content

很多人满怀期待地装完 Obsidian，结果打开发现是一片空白。如果想用它来管理项目、记笔记，通常得先搭一套架子——配模板、装插件、调路径，一套下来，很容易被劝退。

前几期视频我们分别讲了[[7.shared/视频Meta/008-项目管理|任务管理]]和[[7.shared/视频Meta/010-Obsidian homepage|主页搭建]]，但不太熟悉 Obsidian 的朋友还是容易卡在路径不对、功能不生效这些地方。所以我干脆做了一个**开箱即用的模板库**，下载打开就能直接使用。

> [!info] 它是什么
> 这个库就是我平时**真正在用的主仓库**复刻了一份——删掉私人内容，每个功能区保留 1 篇示例笔记 + 配套模板。
> 所以你拿到的不是空壳，也不是一堆要自己拼的零件，而是一个**已经搭好、连好线、能直接跑起来**的库；也可以当参考，照着在自己的库里搭。一页纸版介绍见 [[7.shared/专题Meta/001-obsidian workflow vault|模板库分享页]]。

---

### 一、下载

> [!tip] 仓库地址
> 👉 https://github.com/jady21a/obsidian-workflow-vault
>
> 点 **Code → Download ZIP** 下载压缩包，解压后用 Obsidian 的「Open folder as vault」当作仓库打开即可。

---

### 二、库里有什么

整个库复刻了我日常主仓库（all-in）的目录结构，每个功能区各带一篇 README 说明：

| 目录              | 用途                          |
| --------------- | --------------------------- |
| `1.Rough`       | 速记 / Inbox，未整理的灵感           |
| `2.Read`        | 读书观影（书 / 电影 / 剧集 / 数据库视图）   |
| `3.learn`       | 学习笔记（语言 / AI / 讨论）          |
| `4.Projects`    | 长周期项目管理（项目 / 任务 / 仪表盘）      |
| `5.todo`        | 每日 / 每周待办与复盘                |
| `6.personal`    | 个人日记 / 想法等私域笔记              |
| `9.备忘`          | 不需要完全记住的速查笔记                |
| `10.Template`   | 所有 Templater 模板             |
| `11.Excalidraw` | 手绘 / 白板图                    |
| `12.skills`     | Claude / AI 工作流技能包          |

> 7、8 特意留空——那是我的个人工作学习区，你可以按自己的需求新建。

**第三方插件已经内置**。为了实现真正的「开箱即用」、省去一个个下载的麻烦，需要用到的插件都放在 `.obsidian/plugins/` 里了（README 末尾附了每个插件原作者的页面，长期使用欢迎去 Star / 赞助原作者）。其中**核心必需**的是这几个，缺了对应页面会失效：

- **Dataview** —— 表格 / 统计视图，全库 160+ 处依赖（项目仪表盘、书架、观影库）
- **Templater** —— 模板引擎，新建项目 / 任务自动套模板
- **Tasks** —— 任务查询（首页「今日任务」等）
- **Periodic Notes** + **Calendar** —— 每日 / 每周笔记
- **Homepage** —— 打开 Obsidian 自动停在 homepage 仪表盘
- **Iconize** —— 目录的彩色图标
- **Contribution Graph** —— 首页热力图

书影录入插件（**Book Search** / **Media DB** / **豆瓣**）用到再启用、各自配 API；不装也能用模板手动填字段，只是一键导入更快。

**主题与 CSS**：主题用的 **Minimal**；`.obsidian/snippets/` 里带了 homepage 多栏布局（`homepage-columns`、`MCL Multi Column`、`MCL Gallery Cards`）和几个紧凑化片段（`compact-tasks`、`dataview-compact`、`bases-cards-tweak`）。

**快捷键**：内置了几个我自定义的示例——`Cmd+T` 从模板新建、`Cmd+'` 新建项目、`Cmd+,` 新建任务、`Cmd+.` 插入 try，完整列表见库里的 `9.备忘/示例-快捷键`。

---

### 三、快速上手：三件小事

**第 0 步 · 检查插件和 CSS 片段。**
到 `设置 → 第三方插件`，对照 README 的「依赖插件」把上面核心那几个启用；再到 `设置 → 外观 → CSS 代码片段`，把需要的片段打开。大多数「页面显示不出来 / 报错」都是这一步没做全。

然后打开库里那篇 **「开箱第一件事」**，照着做三件小事，做完一件打一个勾：

**第一件 · 建你的第一篇日记。** 打开 homepage，点「今日笔记」按钮，它会自动套上日记模板，随手写一句今天想做什么。这一步顺便验证了 Templater、Periodic Notes 装没装好。

**第二件 · 建你的第一个项目。** 点「新建 Project」用项目模板起个名（比如「A1 第一个项目」），再用 task 模板给它加一个子任务——**项目名、序号会自动代入**，不用手动填。加好之后，子任务就会出现在项目页里。这套项目与任务的三层联动，建一次就懂了，细节看[[7.shared/视频Meta/008-项目管理|项目管理那期]]。

**第三件 · 导入一本你正在读的书。** 首页点「New Book」搜书名（Book Search），或者用豆瓣插件导入；封面、作者等信息自动抓回，自动排进书架，还能按在读 / 读完等状态筛选。

> [!note] 书架显示方式的变化
> 书架我以前用 **Dataview** 显示，但它渲染太容易卡，所以正在改用 **Bases**（库里已带 `2.Read/bases书架.base` 卡片视图）。Bases 版我还没完全调好，调好后再单独分享。

这三件做完，你的日记、你的项目、你的书已经在库里了——它不再是「我的示例版」，开始有你自己的痕迹。剩下的区不用一次用全，先用顺手的一两个，其余等需要时再开；每个区里的示例笔记，需要时顺手换成你自己的内容，**换完它就彻底是你的**了。

---

### 四、内置的自研插件

模板里还内置了四个我自己写的小插件（在「设置 → 第三方插件」里按需启用）：

| 插件                        | 作用                                                       |
| ------------------------- | -------------------------------------------------------- |
| **Learning System**       | 间隔复习。已上架社区插件，还想加 mindmap 功能，持续完善中，之后单独讲                  |
| **Paste Optimizer**       | 优化粘贴：去掉多余空行、清理版权信息（见[[7.shared/视频Meta/006-自制去版权信息插件|这期]]） |
| **Inline Task Edit Icon** | 任务行尾显示 📅，点击弹日期选择器直接改日期，改完会出现在日历对应那天                     |
| **Easy Delete Image**     | 单击图片再按 Delete，直接把图片引用从正文删掉，不用手动删整行                       |

> Easy Delete Image 只删正文里的引用；可以配合内置的 **Clear Unused Images**，再把没有引用的图片文件清掉。

---

### 五、结语

这套模板仓库只是一个**示例版，不是标准答案**，而是一个能直接跑起来的起点。

使用时别怕改坏——目录名、模板字段、还有这些查询，都可以根据自己的需求来调整。

如果你觉得这个模板好用，或者折腾出了更好的用法，欢迎来评论区交流。