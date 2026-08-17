---
title:
  - 011 - Obsidian ready-to-use template vault
tags:
  - video
videoid: https://youtu.be/ocwFtT9Vs70
bilibiliid: <iframe src="//player.bilibili.com/player.html?isOutside=true&aid=116866865432483&bvid=BV1cNTC65EQF&cid=39674711564&p=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"></iframe>
cover: https://i1.hdslb.com/bfs/archive/994c7e20c40ac45f7f6ed36501f55b6fa3cd0d38.jpg
defaultSource: youtube
date: 2026-07-05
category: obsidian
---

<div class="video-player-container" data-title="Obsidian ready-to-use template vault"></div>

## Obsidian ready-to-use template vault

00:00 Intro
00:36 Download
00:57 What's in the vault
02:22 Quick start: three small things
04:04 My own plugins
05:34 Wrap-up

Code: [obsidian-workflow-vault](https://github.com/jady21a/obsidian-workflow-vault)
Related videos: [[en/7.shared/视频Meta/010-Obsidian homepage|Homepage setup]] · [[en/7.shared/视频Meta/008-项目管理|Project management]] · [[en/7.shared/视频Meta/009-一个指令，让AI 自动生成周复盘|AI weekly review]] · [[en/7.shared/视频Meta/001-自动继承昨日任务|Daily task rollover]] · [[en/7.shared/视频Meta/007-自建个人专属图书馆,douban图片链接失效怎么办|Personal library]]

---

## content

Plenty of people install Obsidian full of expectations, open it up — and find a blank screen. If you want to use it for project management or note-taking, you usually have to build scaffolding first: set up templates, install plugins, fix paths. By the end of all that, it's easy to give up.

In earlier videos I covered [[en/7.shared/视频Meta/008-项目管理|task management]] and [[en/7.shared/视频Meta/010-Obsidian homepage|homepage setup]], but folks newer to Obsidian still get stuck on wrong paths and features that won't fire. So I went ahead and built a **ready-to-use template vault** — download it, open it, and it just works.

> [!info] What it is
> This vault is a replica of the **main vault I actually use every day** — private content removed, with one sample note plus its matching templates kept in each functional area.
> So what you get isn't an empty shell, and it isn't a pile of parts to assemble yourself. It's a vault that's **already built, already wired up, and runs out of the box** — or use it as a reference for building the same thing in your own vault. For a written overview of the whole workflow, see [[en/7.shared/专题Meta/001-obsidian工作流总结|the workflow summary]].

---

### 1. Download

> [!tip] Download the whole vault
> 👉 **[Download the vault (ZIP)](https://count.jz21.eu.org/dl/vault)**
>
> Unzip it, then use Obsidian's "Open folder as vault" to open it as a vault. To look around first, browse the [GitHub repo](https://github.com/jady21a/obsidian-workflow-vault).

---

### 2. What's inside

The vault replicates the folder structure of my daily main vault (all-in), and each area comes with its own README:

| Folder          | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| `1.Rough`       | Quick capture / inbox — unsorted ideas                     |
| `2.Read`        | Reading & watching (books / movies / shows / database views) |
| `3.learn`       | Study notes (languages / AI / discussions)                 |
| `4.Projects`    | Long-running project management (projects / tasks / dashboards) |
| `5.todo`        | Daily & weekly to-dos and reviews                          |
| `6.personal`    | Personal journal, private thoughts                         |
| `9.备忘`          | Quick-reference notes you don't need to memorize           |
| `10.Template`   | All Templater templates                                    |
| `11.Excalidraw` | Sketches / whiteboards                                     |
| `12.skills`     | Claude / AI workflow skill packs                           |

> Folders 7 and 8 are intentionally left empty — that's my personal work/study space. Create your own as needed.

**Third-party plugins come pre-installed.** To make it truly plug-and-play and spare you from downloading them one by one, every plugin the vault needs is already in `.obsidian/plugins/` (the README ends with links to each plugin author's page — if you use them long-term, please go star / sponsor the original authors). The **core, must-have** ones are these; without them the corresponding pages break:

- **Dataview** — tables / stats views, 160+ uses across the vault (project dashboards, bookshelf, watch list)
- **Templater** — the template engine; new projects / tasks auto-apply templates
- **Tasks** — task queries (the homepage "today's tasks", etc.)
- **Periodic Notes** + **Calendar** — daily / weekly notes
- **Homepage** — opens Obsidian straight onto the homepage dashboard
- **Iconize** — colored folder icons
- **Contribution Graph** — the homepage heatmap

The book/movie import plugins (**Book Search** / **Media DB** / **Douban**) can stay disabled until needed, each with its own API to configure. Without them you can still fill in the fields by hand from the templates — one-click import is just faster.

**Theme & CSS**: the theme is **Minimal**; `.obsidian/snippets/` includes the multi-column homepage layout (`homepage-columns`, `MCL Multi Column`, `MCL Gallery Cards`) and a few compactness tweaks (`compact-tasks`, `dataview-compact`, `bases-cards-tweak`).

**Hotkeys**: a few of my custom examples are built in — `Cmd+T` new note from template, `Cmd+'` new project, `Cmd+,` new task, `Cmd+.` insert a try. Full list in the vault at `9.备忘/示例-快捷键`.

---

### 3. Quick start: three small things

**Step 0 · Check plugins and CSS snippets.**
Go to `Settings → Community plugins` and, following the README's "required plugins" list, enable the core ones above; then go to `Settings → Appearance → CSS snippets` and turn on the snippets you need. Most "page won't render / errors out" problems come from skipping this step.

Then open the vault note **「开箱第一件事」** ("first things out of the box") and follow along — three small things, tick one off as you finish it:

**First · Create your first daily note.** Open the homepage and click the "today's note" button — it auto-applies the daily template. Jot down one line about what you want to do today. This step doubles as a check that Templater and Periodic Notes are working.

**Second · Create your first project.** Click "New Project" and name one with the project template (say, "A1 First project"), then add a subtask to it with the task template — **the project name and sequence number fill themselves in**, no manual typing. Once added, the subtask shows up on the project page. This three-layer link between projects and tasks clicks after you build it once; details in [[en/7.shared/视频Meta/008-项目管理|the project management episode]].

**Third · Import a book you're reading.** On the homepage click "New Book" and search the title (Book Search), or import via the Douban plugin; the cover, author, and other metadata come back automatically, the book slots itself onto the shelf, and you can filter by status — reading / finished, and so on.

> [!note] A change in how the bookshelf renders
> I used to render the bookshelf with **Dataview**, but it lags too easily, so I'm switching to **Bases** (the vault ships with a `2.Read/bases书架.base` card view). The Bases version isn't fully tuned yet — I'll share it separately once it is.

With those three done, your daily note, your project, and your book are already in the vault — it's no longer "my sample copy"; it's starting to carry your own fingerprints. No need to use every area at once: start with the one or two that feel natural and open the rest when you need them. Swap each area's sample note for your own content as you go — **once swapped, the vault is completely yours**.

---

### 4. My own plugins, built in

The vault also bundles four small plugins I wrote myself (enable as needed under `Settings → Community plugins`):

| Plugin                    | What it does                                              |
| ------------------------- | --------------------------------------------------------- |
| **Learning System**       | Spaced repetition. Already in the community plugin store; mindmap support planned, actively improving — I'll cover it separately |
| **Paste Optimizer**       | Cleaner pasting: strips extra blank lines and copyright boilerplate (see [[en/7.shared/视频Meta/006-自制去版权信息插件|this episode]]) |
| **Inline Task Edit Icon** | Shows a 📅 at the end of task lines; click it for a date picker to change the date in place — the task then appears on that day in the calendar |
| **Easy Delete Image**     | Click an image, press Delete, and the image reference is removed from the text — no hunting down the whole line |

> Easy Delete Image only removes the reference in the text; pair it with the bundled **Clear Unused Images** to then delete image files nothing references anymore.

---

### 5. Wrap-up

This template vault is a **sample, not the standard answer** — a starting point that runs out of the box.

Don't be afraid of breaking it — folder names, template fields, and the queries are all yours to reshape around your own needs.

If the template works well for you, or you tinker your way to something better, come share it in the comments.
