---
title: 013-图书馆&影视库2-bases版
tags:
  - video
videoid:
bilibiliid:
defaultSource: bilibili
date: 2026-10-29
category: obsidian
draft: true
---

<div class="video-player-container" data-title="图书馆&影视库2-bases版"></div>

```text
00:00 引言
XX:XX 原生卡片的两个坑
XX:XX 一页总览
XX:XX 卡片直接改
XX:XX 影视库
XX:XX 结语
```

相关代码:[Editable Cards 插件](https://github.com/jady21a/obsidian-editable-cards)、两份 `.base` 见下文[[#配置文件]]
相关视频:[[7.shared/视频Meta/007-自建个人专属图书馆,douban图片链接失效怎么办|图书馆 1(Dataview 版)]]、[[7.shared/视频Meta/011-obsidian开箱即用模板库|开箱即用模板库]]

---

## content

在[[7.shared/视频Meta/007-自建个人专属图书馆,douban图片链接失效怎么办|上一期图书馆]]里,我用 Dataview 做了图书馆和影视库。当时没选 Bases,是因为 Bases 信息一多就难看,而且一个页面没法把书分类放好,得在好几个视图之间来回切。

但 Dataview 版的书架越用越卡,书一多,光是打开就要转半天。于是我把显示的问题解决掉,整个图书馆和影视库都搬到了 Bases。现在打开一页,在读的、读完的、待读的全在这,字段点一下就能改。

这一页按动手顺序写:先看为什么要改、改完是什么样,再给插件、配置文件和搭建步骤,照着做就能在自己的库里复现。

---

## 为什么换

**Dataview 太卡**。Dataview 的表格每次打开都要现场查询、渲染,书架页一多封面,卡顿非常明显。Bases 是 Obsidian 1.10 起的核心插件,渲染快得多。

**但原生 Bases 卡片有两个坑**:

1. **想看全,得来回切视图**。原生卡片一个视图只能配一套字段,而不同状态的书关心的东西不一样:在读看进度,已读看用时,待读看豆瓣分。结果就是在读一个视图、读完一个视图、未开始又一个视图。
2. **卡片只读,点哪都跳走**。想把页码改成今天读到的位置,一点卡片就直接打开笔记了。我找了一圈,GoodBases 插件也只做到了表格里直接改,卡片编辑还在它的 roadmap 上。

所以我让 AI 写了个小插件 **Editable Cards**,给 Bases 加一种新的视图类型 `editable-cards`:分组显示、每组字段不同、卡片上直接改。

---

## 一页总览

图书馆的「书架总览」视图会按阅读状态自动分成 5 组,每组只显示它关心的字段:

| 组     | 卡片显示的字段                             | 用来回答         |
| ------ | ------------------------------------------ | ---------------- |
| 在读   | 作者、当前页、进度、页数、开始阅读、距今   | 读到哪、读了多久 |
| 已读   | 作者、方式、评分、推荐指数、结束阅读、用时 | 读了几天、值不值 |
| 待读   | 作者、评分、页数、添加时间                 | 下一本读什么     |
| 未读完 | 作者、页数、进度、开始阅读、距今           | 停在哪、搁了多久 |
| 概览   | 作者、状态、评分、推荐指数、添加时间       | 只粗翻过的书     |

- **分组规则**:读 `阅读状态` 字段判断;`阅读方式` 含「概览」的书单独归到概览组(正在读的除外)。
- **组内排序**:按「最近动静」倒序,也就是结束阅读、开始阅读、添加时间里最近的那个日期,都没有就用文件创建时间。
- **顶部目录**:两组以上时顶部有一排吸顶目录(组名 + 本数),点哪组就平滑滚到哪组,跟以前 Dataview 页点大纲标题跳转一样。
- **「全部」**:目录最后一项,点了就不分组,所有书平铺开,按添加时间倒序;再点任一组名回到分组模式。

同一份 `bases图书馆.base` 里还有一个「年度书单」表格视图:只列已读完且填了结束日期的书,按读完年份分组,每年读了哪些书一目了然。

---

## 卡片直接改

在 Editable Cards 视图里,卡片上的字段分两种:

| 字段类型             | 卡片上的表现                               |
| -------------------- | ------------------------------------------ |
| `note.*`(笔记属性)   | 输入框,点一下就能改,回车或点别处即写回笔记 |
| `formula.*`(公式)    | 只读,随属性自动重算                        |
| `file.*`、封面、书名 | 只读;点封面或书名打开笔记                  |

比如在读组里一本 450 页的书,把「当前页」从 76 改成 120,回车后「进度」立刻从 17% 变成 27%;打开笔记,属性面板里的 `currentPage` 也已经是 120。全程不跳转、没有弹窗。

几个细节:

- 写回走官方的 `processFrontMatter` 接口,列表字段保持列表、数字字段保持数字,不会把 frontmatter 改坏。
- 中文输入法选词时按的回车不算提交。
- 笔记里没有的字段(比如某本书没写 `currentPage`),在卡片上填值会自动新建这个属性。
- 进度、用时、距今这些是公式算的,本来也不用手填,页码一改它自己就算。

---

## 影视库

`bases影视库.base` 是同一套做法,一共 4 个视图:

| 视图     | 类型     | 内容                                                |
| -------- | -------- | --------------------------------------------------- |
| 影视总览 | 卡片分组 | 在看 / 已看 / 待看 / 弃剧,顶部目录跳转,「全部」平铺 |
| 片单     | 表格     | 按状态分组,底部汇总豆瓣分、我的分、口味差的平均值   |
| 口味对照 | 表格     | 只列我打过分的片子,按「我-豆瓣」从高到低排          |
| 按年代   | 卡片分组 | 按上映年代(2020s、2010s……)分组                      |

影视总览的排序:待看组按豆瓣分从高到低(挑片用),其余组按最近一次动静的日期倒序。

**「我-豆瓣」口味差**就是我自己的评分减豆瓣评分:正数说明我比大家更喜欢,负数就是豆瓣高分但我没 get 到。「口味对照」视图底部有平均值,翻一翻能看出自己的口味偏向。

---

## 搭建

### 所需插件

| 插件               | 类型     | 作用                                      | 必需 |
| ------------------ | -------- | ----------------------------------------- | ---- |
| Bases(数据库)      | 核心插件 | `.base` 视图本体,Obsidian 1.10 起         | 是   |
| Editable Cards     | 自制     | 可编辑卡片视图:分组、吸顶目录、原地改字段 | 是   |
| Base Source Editor | 社区插件 | 用源码模式改 `.base` 的 YAML              | 推荐 |

推荐装 Base Source Editor,是因为 `groupOrders`、`allOrder`、`allSort` 这几个键是 Editable Cards 自己读的,Bases 的「属性」菜单里改不到,只能改 YAML。它要求 Obsidian 1.13.7 以上。

> [!tip] 下载
> - **Editable Cards**:从 [GitHub Releases](https://github.com/jady21a/obsidian-editable-cards/releases) 下载 `main.js`、`manifest.json`、`styles.css` 三个文件。还没上架社区市场,也可以用 BRAT 安装 `jady21a/obsidian-editable-cards`。
> - **两份 `.base`**:见下文[[#配置文件]],复制成同名文件放进库里。

### 文件放哪

| 文件                                   | 放在                                | 作用                                  |
| -------------------------------------- | ----------------------------------- | ------------------------------------- |
| `main.js` `manifest.json` `styles.css` | `.obsidian/plugins/editable-cards/` | 插件本体                              |
| `bases图书馆.base`                     | 库里任意文件夹                      | 书架总览(卡片)+ 年度书单(表格)        |
| `bases影视库.base`                     | 库里任意文件夹                      | 影视总览 / 片单 / 口味对照 / 按年代   |
| `bases-cards-tweak.css`                | `.obsidian/snippets/`               | 可选美化,只影响原生卡片和视图切换下拉 |

我自己的两份 `.base` 放在 `2.Read/dataview/`,位置不影响使用。

### 步骤

1. **准备 Obsidian**:升级到 1.10 以上(要用 Base Source Editor 则 1.13.7 以上),`设置 → 核心插件` 里打开「数据库」(Bases)。
2. **装 Base Source Editor**:`设置 → 第三方插件 → 浏览`,搜索安装并启用。
3. **装 Editable Cards**:在库里新建 `.obsidian/plugins/editable-cards/` 文件夹,放入那三个文件,然后 `设置 → 第三方插件` 点刷新,启用 Editable Cards(Bases)。装完或更新后要**整窗重载**(Cmd+R,或命令面板执行「重新加载应用」),只开关插件不生效。
4. **放 `.base`**:把两份 `.base` 放进库里,按自己的笔记改三处:
   - `filters` 里的标签(`book` / `movies`)和要排除的模板文件夹(我的是 `10.Template`);
   - `formulas` 里引用的属性名,要和你笔记 frontmatter 的字段名一致(字段表见下一节);
   - `groupOrders` 下的组名,要和「分组」公式的结果去掉数字前缀后一致:公式写 `1|在读`,这里就写 `在读`。竖线前的数字只决定组的先后,显示时会去掉。

   字段名和我的差得多,可以把这一步交给 AI,见[[#用 AI 适配]]。
5. **按组配字段**:在 `groupOrders` 下给每组列出要显示的字段,写法同 `order`;没配的组沿用视图的 `order`。想在卡片上改页码,就把 `currentPage` 放进在读组。
6. **配「全部」**:`allOrder` 是平铺时显示的字段,`allSort: 属性名` 是平铺时的排序(倒序,空值垫底)。
7. **可选美化**:把 `bases-cards-tweak.css` 放进 `.obsidian/snippets/`,在 `设置 → 外观 → CSS 代码片段` 里启用。它让原生卡片的标签和值并排一行,并修掉视图切换下拉里「看起来总是高亮第一个视图」的问题。

### 字段约定

两份 `.base` 的公式依赖下面这些 frontmatter 字段。字段名不同就改公式里的名字,没有某个字段也不会报错,对应的列空着而已。

**图书**(筛选条件:`tags` 含 `book`)

| 字段                             | 取值 / 用途                                  |
| -------------------------------- | -------------------------------------------- |
| `阅读状态`                       | 未开始 / 正在阅读 / 已读完 / 未读完,决定分组 |
| `阅读方式`                       | 含「概览」就归到概览组                       |
| `currentPage` `totalPage`        | 算进度                                       |
| `进度`                           | 有值时优先用它,不再按页码算                  |
| `开始阅读` `结束阅读` `添加时间` | 算用时、距今、读完年份,以及排序              |
| `score` `myRate` `封面`          | 豆瓣分、推荐指数、卡片封面                   |

**影视**(筛选条件:`tags` 含 `movies`)

| 字段                             | 取值 / 用途                            |
| -------------------------------- | -------------------------------------- |
| `state`                          | 待看 / 正在观看 / 已看 / 弃剧,决定分组 |
| `type`                           | movie / teleplay / series,算媒介       |
| `score` `myRating`               | 豆瓣分、我的分,算「我-豆瓣」           |
| `datePublished`                  | 算年份、年代                           |
| `genre` `director` `country`     | 题材、导演、地区(各取前几项)           |
| `开始时间` `结束时间` `添加时间` | 排序                                   |



### 用 AI 适配

插件不用改,要改的只是 `.base` 里的字段名、标签和组名,这类 YAML 修改正适合交给 AI。把下面这段提示词连同两样东西一起发给 ChatGPT、Claude 等任意 AI:你的**一篇书籍笔记的 frontmatter**,和下文[[#配置文件]]里的 **`bases图书馆.base` 全文**。影视库同理,换成影视笔记和 `bases影视库.base`。

> [!example]- 提示词:让 AI 按我的字段改 .base
> ```text
> 我在用 Obsidian Bases 和 Editable Cards 插件做书架。下面是一份别人写好的 .base 文件,
> 以及我自己一篇书籍笔记的 frontmatter。请把 .base 改成能直接用在我库里的版本:
>
> 1. filters:筛选标签改成我笔记里实际用的标签;排除的模板文件夹改成:(填你的模板文件夹,没有就删掉这一行)
> 2. formulas:把公式里引用的属性名换成我 frontmatter 里对应的字段名;
>    属性的取值(如「正在阅读」「已读完」)也按我的实际写法改。
> 3. 「分组」公式的结果格式保持「数字|组名」,groupOrders 下的组名要和去掉数字前缀后的组名一致。
> 4. order、groupOrders、allOrder、allSort、sort 里的属性名同步替换。
> 5. 我没有的字段:对应的公式和显示列直接删掉,不要编造字段。
> 6. 不要改动 views 的结构和 type: editable-cards,groupOrders / allOrder / allSort 是插件自定义键,保留。
>
> 最后输出完整的 .base 文件,并列一张「原字段 → 我的字段」对照表,标出你删掉了哪些。
>
> 【.base 文件】
> (粘贴 bases图书馆.base 全文)
>
> 【我的笔记 frontmatter】
> (粘贴一篇书籍笔记最上面 --- 之间的内容)
> ```

拿到结果后,用 Base Source Editor 打开你的 `.base`,整段替换保存,再对照 AI 给的对照表检查一遍。如果某组显示为空,通常是「分组」公式里的取值和你笔记里的写法对不上(比如你写的是「在读」而不是「正在阅读」)。

> [!tip]- 用 Claude Code / Codex 的话
> 这类能读写本地文件的 AI 工具,可以把放文件和改字段一起做掉:把本页链接和你的库路径交给它,让它按「搭建」一节放好插件和 `.base`,再按上面的提示词把 `.base` 改成你的字段。交代任务时加上三条约束:
> 1. **只新增文件,不修改任何已有笔记**;
> 2. **先关掉 Obsidian,或者在库的副本里做**(Obsidian 开着时会覆盖它对配置的改动;库在 iCloud 上的话改动还会同步到所有设备);
> 3. **启用插件、整窗重载留给自己在界面里点**,不要让它改 `.obsidian` 下的 `core-plugins.json` / `community-plugins.json`。
>
> 做完后自己打开 Obsidian,按步骤 1–3 打开开关、重载,再打开 `.base` 看效果。

> [!note] 想加功能
> 想要日期选择器、下拉框这类插件现在没有的功能,建议在插件源码上改,不要让 AI 从零写:Bases 的视图 API 是 Obsidian 1.10 才加的,AI 很少见过,从头写容易调不通。clone [插件仓库](https://github.com/jady21a/obsidian-editable-cards)后让 AI 改 `main.ts`,README 里写了构建方法。

---

## 配置文件

下面是我库里正在用的两份,复制后保存成 `bases图书馆.base` 和 `bases影视库.base`(注意扩展名是 `.base`,不是 `.md`)。图书馆的在读组已经加上了 `currentPage`,可以直接在卡片上改页码。

> [!example]- bases图书馆.base
> ```yaml
> filters:
>   and:
>     - file.hasTag("book")
>     - '!file.inFolder("10.Template")'
> formulas:
>   状态: if(阅读状态.contains("已读完"), "已读完", if(阅读状态.contains("正在阅读"), "在读", if(阅读状态.contains("未读完"), "未读完", "未开始")))
>   用时: if(结束阅读 && (开始阅读 || 添加时间), (date(结束阅读) - date(if(开始阅读, 开始阅读, 添加时间))).days.toString() + " 天", "")
>   距今: if(开始阅读, (now() - date(开始阅读)).days.round(0).toString() + " 天", "")
>   进度: if(note.进度, if(note.进度.toString().contains("%"), note.进度.toString(), note.进度.toString() + "%"), if(currentPage && totalPage, (number(currentPage) / number(totalPage) * 100).round(0).toString() + "%", ""))
>   读完年份: if(结束阅读, date(结束阅读).year, "")
>   最近动静: if(结束阅读, date(结束阅读), if(开始阅读, date(开始阅读), if(添加时间, date(添加时间), file.ctime)))
>   分组: if(阅读状态.contains("正在阅读") && !阅读状态.contains("已读完"), "1|在读", if(if(阅读方式, list(阅读方式).contains("概览"), false), "5|概览", if(阅读状态.contains("已读完"), "2|已读", if(阅读状态.contains("未读完"), "4|未读完", "3|待读"))))
> properties:
>   file.name:
>     displayName: 书名
>   note.originalTitle:
>     displayName: 原标题
>   note.author:
>     displayName: 作者
>   note.score:
>     displayName: 评分(10)
>   note.scoreStar:
>     displayName: 评分
>   note.myRate:
>     displayName: 推荐指数
>   note.totalPage:
>     displayName: 页数
>   note.publishDate:
>     displayName: 出版
>   note.添加时间:
>     displayName: 添加
>   note.阅读方式:
>     displayName: 方式
>   formula.状态:
>     displayName: 状态
>   formula.用时:
>     displayName: 用时
>   formula.距今:
>     displayName: 距今
>   formula.进度:
>     displayName: 进度
>   formula.读完年份:
>     displayName: 年份
>   formula.分组:
>     displayName: 分组
> views:
>   - type: editable-cards
>     name: 书架总览
>     groupBy:
>       property: formula.分组
>       direction: ASC
>     order:
>       - file.name
>       - author
>       - formula.进度
>       - score
>       - myRate
>       - 添加时间
>     sort:
>       - property: formula.最近动静
>         direction: DESC
>     groupOrders:
>       在读:
>         - file.name
>         - author
>         - currentPage
>         - formula.进度
>         - totalPage
>         - 开始阅读
>         - formula.距今
>       已读:
>         - file.name
>         - author
>         - 阅读方式
>         - score
>         - myRate
>         - 结束阅读
>         - formula.用时
>       待读:
>         - file.name
>         - author
>         - score
>         - totalPage
>         - 添加时间
>       未读完:
>         - file.name
>         - author
>         - totalPage
>         - formula.进度
>         - 开始阅读
>         - formula.距今
>       概览:
>         - file.name
>         - author
>         - formula.状态
>         - score
>         - myRate
>         - 添加时间
>     allOrder:
>       - file.name
>       - author
>       - formula.状态
>       - score
>       - myRate
>       - 添加时间
>       - formula.进度
>       - formula.用时
>     allSort: 添加时间
>     image: note.封面
>     imageAspectRatio: 0.7
>     cardSize: 160
>     imageFit: contain
>   - type: table
>     name: 年度书单
>     filters:
>       and:
>         - 阅读状态.contains("已读完")
>         - 结束阅读
>     groupBy:
>       property: formula.读完年份
>       direction: DESC
>     order:
>       - file.name
>       - author
>       - scoreStar
>       - 开始阅读
>       - 结束阅读
>       - formula.用时
>     sort:
>       - property: 结束阅读
>         direction: DESC
>     summaries:
>       file.name: Filled
> ```

> [!example]- bases影视库.base
> ```yaml
> filters:
>   and:
>     - file.hasTag("movies")
>     - '!file.inFolder("10.Template")'
> formulas:
>   状态: if(state.contains("已看"), "已看", if(state.contains("正在观看"), "在看", if(state.contains("弃剧"), "弃剧", "待看")))
>   媒介: if(type == "movie", "电影", if(type == "teleplay" || type == "series", "剧集", "其他"))
>   豆瓣: if(score, number(score), "")
>   我的: if(myRating, number(myRating), "")
>   口味差: if(myRating && score, (number(myRating) - number(score)).round(1), "")
>   年份: if(datePublished, date(datePublished).year, "")
>   年代: if(datePublished, ((date(datePublished).year / 10).floor() * 10).toString() + "s", "")
>   题材: if(genre, list(genre).slice(0, 3).join(" · "), "")
>   导演: if(director, list(director).slice(0, 2).join(" / "), "")
>   地区: if(country, list(country).slice(0, 2).join(" / "), "")
>   记录日: if(结束时间, 结束时间, 添加时间)
>   # 影视总览用:组名前的数字只控制组的先后,editable-cards 插件显示时会去掉
>   分组: if(formula.状态 == "在看", "1|在看", if(formula.状态 == "已看", "2|已看", if(formula.状态 == "待看", "3|待看", "4|弃剧")))
>   # 影视总览排序用:待看组按豆瓣分,其余组按最近一次动静(结束→开始→添加)的日期,都是大的在前
>   排序键: if(formula.状态 == "待看", if(score, number(score), 0), number(date(if(结束时间, 结束时间, if(开始时间, 开始时间, if(添加时间, 添加时间, file.ctime)))).format("YYYYMMDD")))
> properties:
>   file.name:
>     displayName: 片名
>   note.myRating:
>     displayName: 我的评分
>   note.state:
>     displayName: 状态标记
>   note.添加时间:
>     displayName: 添加
>   formula.状态:
>     displayName: 状态
>   formula.媒介:
>     displayName: 媒介
>   formula.豆瓣:
>     displayName: 豆瓣
>   formula.我的:
>     displayName: 我的
>   formula.口味差:
>     displayName: 我-豆瓣
>   formula.年份:
>     displayName: 年份
>   formula.年代:
>     displayName: 年代
>   formula.题材:
>     displayName: 题材
>   formula.导演:
>     displayName: 导演
>   formula.地区:
>     displayName: 地区
> views:
>   - type: editable-cards
>     name: 影视总览
>     # 以下三个是插件 editable-cards 的自定义键,只能在 YAML 里改,「属性」菜单改不到
>     groupOrders:
>       在看: [file.name, formula.媒介, formula.题材, formula.导演, formula.豆瓣, formula.地区, formula.年份, state]
>       已看: [file.name, formula.媒介, formula.题材, formula.导演, formula.豆瓣, formula.地区, formula.年份, myRating]
>       待看: [file.name, formula.媒介, formula.题材, formula.导演, formula.豆瓣, formula.地区, formula.年份]
>       弃剧: [file.name, formula.媒介, formula.题材, formula.导演, formula.豆瓣, formula.地区, formula.年份]
>     # 顶部目录「全部」:平铺所有片子
>     allOrder: [file.name, formula.媒介, formula.状态, formula.题材, formula.导演, formula.豆瓣, formula.地区, formula.年份]
>     allSort: formula.豆瓣
>     groupBy:
>       property: formula.分组
>       direction: ASC
>     order:
>       - file.name
>       - formula.媒介
>       - formula.题材
>       - formula.导演
>       - formula.豆瓣
>       - formula.地区
>       - formula.年份
>     sort:
>       - property: formula.排序键
>         direction: DESC
>     image: note.封面
>     imageAspectRatio: 0.7
>     cardSize: 160
>     imageFit: contain
>   - type: table
>     name: 片单
>     groupBy:
>       property: formula.状态
>       direction: ASC
>     order:
>       - file.name
>       - formula.媒介
>       - formula.年份
>       - formula.题材
>       - formula.导演
>       - formula.地区
>       - formula.豆瓣
>       - formula.我的
>       - formula.口味差
>       - 添加时间
>     sort:
>       - property: formula.豆瓣
>         direction: DESC
>     summaries:
>       file.name: Filled
>       formula.豆瓣: Average
>       formula.我的: Average
>       formula.口味差: Average
>   - type: table
>     name: 口味对照
>     filters:
>       and:
>         - myRating
>     order:
>       - file.name
>       - formula.豆瓣
>       - formula.我的
>       - formula.口味差
>       - formula.题材
>       - formula.导演
>     sort:
>       - property: formula.口味差
>         direction: DESC
>     summaries:
>       formula.口味差: Average
>   - type: editable-cards
>     name: 按年代
>     groupBy:
>       property: formula.年代
>       direction: DESC
>     order:
>       - file.name
>       - formula.媒介
>       - formula.导演
>       - formula.豆瓣
>       - formula.地区
>     sort:
>       - property: datePublished
>         direction: DESC
>     image: note.封面
>     imageAspectRatio: 0.7
>     cardSize: 160
>     imageFit: contain
> ```

---

# 补充

- **进度不跟着页码变?** 检查这本书的笔记里是不是有 `进度` 字段:进度公式优先读它,有值就不再按 `currentPage / totalPage` 算。删掉或清空它即可。
- **改了 `.base` 或更新插件后视图没变?** 已注册的视图类型要整窗重载才会换新,Cmd+R 或「重新加载应用」。
- **字段被截断?** 卡片上的书名和字段都是单行,放不下末尾显示省略号,悬停看全文。想少截断,就在 Bases 里给长属性名起个短的显示名(如 `totalPage` 显示成「页数」)。
- **当前限制**:所有可编辑字段都是文本输入框,日期选择器、下拉、复选框还没做(写回时会保留列表和数字类型)。
- **想给某组单独上色**:组标题和目录项都带 `data-group="组名"`,可以在插件的 `styles.css` 里按它写选择器。

---

## 结语

插件和两份 `.base` 都在上面,拷进自己的库,改改字段名就能用。

还有一个小痛点:开始 / 结束阅读的日期老是忘了填,等想起来已经不记得哪天读完的。我后来找到了自动填入的办法,后续再分享。今天的分享就到这里,欢迎讨论。
