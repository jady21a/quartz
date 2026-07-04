---
title: 007 - Build your own personal library; what to do when douban image links break
tags:
  - video
videoid: OrVOLyWmqz4
bilibiliid: BV1UjR4BZEHT
defaultSource: youtube
date: 2026-05-06
category: obsidian
---

<div class="video-player-container" data-youtube="OrVOLyWmqz4" data-bilibili="BV1UjR4BZEHT">
  <lite-youtube videoid="VIDEO_ID" playlabel="视频标题"></lite-youtube>
</div>

## Building your own Obsidian library and media library — what to do when douban images break?
In this video:
- How to build an Obsidian library / media library
- Dataview vs. Bases, the two display options compared
- Why douban images break + alternatives
- A Dataview query that supports both local images and remote URLs


Chapters:
00:00 Building the library and media library
00:18 Comparing the two display options
00:50 The douban plugin stops working
01:29 Alternatives and setup
02:01 Fixing local image paths

Related code: [[book-ch|douban book template]]   [[book-en|book-search book template]]    [[movie-ch|douban movie template]]    [[movie-en|Media DB template]]
Related video:  [[en/7.video/Metadata/005-写笔记=更新博客|005 - Writing a note = updating the blog]]


## content
I used to build a library and a media library inside Obsidian. The Library and Watch List on my blog were inspired by that setup.
Main steps: install the plugin → set up a template → display the page.
Display options
- dataview
- bases

Issues with displaying via Bases:
- it starts to look messy once there's a lot of information
- it can't show everything you need on a single page

douban used to let you build and display a full book/movie library, but later it likely tightened its hotlink protection, so importing metadata breaks the images and they won't display.
Here are the alternatives I found:
- BookSearch: can import English-language books
- Media DB: can import movies / TV series / music / books, etc.
- If none of the above plugins can find the metadata you need, you can import the metadata with douban first, then find and replace the images yourself from the web page
- If the images are downloaded locally, you need to modify the Dataview query code so it supports both remote URLs and local paths

Note: when setting up templates, they won't take effect without the `.md` extension.
- `movieTemplate: "10.Template/影视.md"`
- `seriesTemplate: "10.Template/影视.md"`


Required plugins
- Douban
- Templater
- Dataview
- BookSearch
- Media DB

If you have good ideas, let me know too — let's brainstorm together.
