---
title: 007-自建个人专属图书馆,douban图片链接失效怎么办
tags:
  - video
videoid: OrVOLyWmqz4
bilibiliid: BV1UjR4BZEHT
cover: https://i0.hdslb.com/bfs/archive/182883e8cc12c04f762b574b836deac58279e7ed.jpg
defaultSource: bilibili
date: 2026-05-06
category: obsidian
---

<div class="video-player-container" data-youtube="OrVOLyWmqz4" data-bilibili="BV1UjR4BZEHT">
  <lite-youtube videoid="VIDEO_ID" playlabel="视频标题"></lite-youtube>
</div>

## 自建 Obsidian 个人图书馆和影视库，Douban 图片失效怎么办？
本期内容：
- Obsidian 图书馆 / 影视库搭建思路
- Dataview 和 Bases 两种展示方案对比
- 豆瓣图片失效原因 + 替代方案
- 本地图片与远程 URL 兼容的 Dataview 查询写法


章节：
00:00 搭建图书馆与影视库
00:18 2种展示方案比较
00:50 豆瓣插件失效
01:29 替代方案与设置
02:01 本地图片路径修改

相关代码: [[book-ch|douban书籍模板]]   [[book-en|book search书籍模板]]    [[movie-ch|douban电影模板]]    [[movie-en|media DB模板]]
相关视频:  [[7.shared/视频Meta/005-写笔记=更新博客]]


## content
我以前在 Obsidian 做了一个图书馆和影视库。我博客中的藏书馆和影视库就是受这个启发搭建起来的。
主要操作：插件下载 -> 设置模板 -> 展示页面。
展示方案
- dataview
- bases

Bases 展示页面的问题：
- 显示的信息一多就会不好看
- 不能一个页面显示所有需要的信息

以前 Douban 就可以完整地搭建和展示一个图书影视库，但是后来豆瓣可能加强了防盗链，导入元信息时会导致图片失效无法显示。
下面是我找到的替代方法：
- BookSearch：可导入英文书籍
- Media DB：可导入电影 / 电视剧 / 音乐 / 书籍等
- 如果以上插件都找不到需要导入的元信息，可以先用 Douban 导入元信息，然后在网页上自己找到相应的图片替换
- 如果图片下载在本地，需要修改 Dataview 查询代码，让它同时支持远程 URL 和本地路径

注意：设置模板时如果没有添加 `.md` 不会生效。
- `movieTemplate: "10.Template/影视.md"`
- `seriesTemplate: "10.Template/影视.md"`


所需插件
- Douban
- Templater
- Dataview
- BookSearch
- Media DB

如果大家有好的想法也可以告诉我，集思广益。
