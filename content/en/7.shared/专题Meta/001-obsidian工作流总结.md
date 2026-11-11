---
title:
  - 001 - My Obsidian workflow, the full picture
tags:
  - topic
  - obsidian
date: 2026-07-10
category: obsidian
description: "Eleven scattered videos tied into one pipeline: homepage entry point, daily task rollover, project management, AI weekly review, personal library, blog publishing — the whole system on one page."
updatesHub: true
draft:
---

Each episode in the video collection covered one piece of the system. This page assembles all the pieces into a single map.
> [!abstract] In short
> Obsidian is the operating system, templates + Dataview the automation engine, git + AI the review engine, Quartz the output end.
> Information moves through one fixed pipeline: **capture → daily execution → project progress → periodic review → publishing**.

## Future improvements

Improvements added after the videos came out, newest first. "Related" lists the episodes each one touches; those episode pages show it automatically at the bottom.

- **2026-11-11 · Project progress**: the task table on each main-project page moved from Dataview to Bases. Completion, mood and check can now be edited right in the table without opening the task note, and all projects share one view, so columns change in one place. Related: [[en/7.shared/视频Meta/008-项目管理|episode 008]]

  This assumes each task has a `project` property matching the main-project page's `project`. Steps:

  1. in your project .base file, add a table view filtered by `file.inFolder("4.Projects/II.tasks")` and `project == this.project`, and name it "本项目task"
  2. replace the old dataview table on the project page with `![[项目.base#本项目task]]`; when embedded, `this` means the current project page

- **2026-11-11 · Homepage**: the Projects card under "Quick navigation" now uses Bases to list every main project automatically, so new projects show up on their own instead of being linked by hand. "Recent notes" switched to Bases too. Related: [[en/7.shared/视频Meta/010-Obsidian homepage|episode 010]]

  This assumes main-project notes have `type: main-project` in their properties. Steps:

  1. in your project .base file, add a list view filtered by `type == "main-project"` and name it "首页项目"
  2. embed it in the homepage card with `![[项目.base#首页项目]]`

- **2026-11-09 · Homepage**: click a cell in the word-count heatmap and the files changed that day are listed under the chart, each with its words added and removed, in two groups: "edited by me" and "edited by AI", each showing its words added and its share of the day. Related: [[en/7.shared/视频Meta/010-Obsidian homepage|episode 010]], [[en/7.shared/视频Meta/011-obsidian开箱即用模板库|episode 011]]

  "Edited by me" word counts come from Better Word Count; "edited by AI" ones come from Claude Code and Codex session logs.

  The homepage in the [obsidian-workflow-vault](https://github.com/jady21a/obsidian-workflow-vault) template vault already includes this. To bring it into your own vault you need:

  1. the "word-count heatmap" code block from the homepage
  2. the script `.obsidian/scripts/wordheat_index.py`, which runs automatically when the homepage opens
  3. python3 installed on your computer

  To see exactly which files changed on a given day, the vault needs to be under git.

- **2026-11-09 · Project progress**: creating a task while a main project page is open now uses that project's category automatically — no prompt, you only fill in the title. Code at the top of [[task - template|task-template]]. Related: [[en/7.shared/视频Meta/002-模版自动归档、命名与编号|episode 002]], [[en/7.shared/视频Meta/008-项目管理|episode 008]]
- **2026-10-19 · Content input**: the library and media library moved to Bases. Books are shown as cards grouped by reading, finished, to-read and so on; films by watching, to-watch and watched; fields can be edited right on the card. Genre, director and country imported from Douban stay as lists. Related: [[en/7.shared/视频Meta/007-自建个人专属图书馆,douban图片链接失效怎么办|episode 007]], [[en/7.shared/视频Meta/011-obsidian开箱即用模板库|episode 011]]
- **2026-09-03 · Project progress**: a newly inserted try entry shows up in the task table right away, instead of only after every blank is filled. Related: [[en/7.shared/视频Meta/008-项目管理|episode 008]]
- **2026-08-07 · Project progress**: the "high-priority projects" table in the project overview now hides finished projects correctly. Picking "已完成" in the properties panel used to have no effect — thanks to a Bilibili viewer for the bug report. Related: [[en/7.shared/视频Meta/008-项目管理|episode 008]]
- **2026-07-06 · Homepage**: after downloading the template vault, the word-count heatmap shows data right away, with no more missing vault-stats.json error. Related: [[en/7.shared/视频Meta/010-Obsidian homepage|episode 010]], [[en/7.shared/视频Meta/011-obsidian开箱即用模板库|episode 011]]
- **2026-07-06 · Project progress**: when the task category is a2, a separate video-task template is used instead; every other category still uses the general template. Handy when one kind of task needs its own fields. Related: [[en/7.shared/视频Meta/002-模版自动归档、命名与编号|episode 002]], [[en/7.shared/视频Meta/008-项目管理|episode 008]]
- **2026-06-23 · Homepage**: the ECharts plugin was delisted from the community store, so the word-count heatmap now uses Contribution Graph, and the new homepage keeps 3 heatmaps. How to install the original plugin by hand, plus a side-by-side comparison, is in episode 010. Related: [[en/7.shared/视频Meta/010-Obsidian homepage#The obsidian-echarts plugin being delisted|episode 010]]
- **2026-06-05 · Project progress**: if you hit Cancel in the prompt while creating a task, the blank note that was just created is deleted automatically, so no junk files are left behind. Code in [[task - template|task-template]]. Related: [[en/7.shared/视频Meta/002-模版自动归档、命名与编号|episode 002]], [[en/7.shared/视频Meta/008-项目管理|episode 008]]
- **2026-05-05 · Daily execution**: the daily note template gained a Scheduled module — recurring tasks that are due or overdue show up in that day's note automatically. Related: [[en/7.shared/视频Meta/001-自动继承昨日任务|episode 001]], [[en/7.shared/视频Meta/008-项目管理|episode 008]]

  The code is the `## scheduled` block in the [[daily|daily template]]; copy the whole block into your own daily template.

---

## The big picture

| Stage            | What it handles                        | Episode                                                                                                        |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Capture          | Open and write, zero friction          | [[en/7.shared/视频Meta/010-Obsidian homepage\|010 Homepage]]                                                    |
| Daily execution  | Today's work, prepared automatically   | [[en/7.shared/视频Meta/001-自动继承昨日任务\|001 Task rollover]]                                                |
| Project progress | Long-running projects never lose the thread | [[en/7.shared/视频Meta/008-项目管理\|008 Project management]], [[en/7.shared/视频Meta/002-模版自动归档、命名与编号\|002 Template automation]] |
| Periodic review  | See yourself clearly, every week       | [[en/7.shared/视频Meta/009-一个指令，让AI 自动生成周复盘\|009 AI weekly review]]                                |
| Content intake   | Books and movies get a home            | [[en/7.shared/视频Meta/007-自建个人专属图书馆,douban图片链接失效怎么办\|007 Personal library]], [[en/7.shared/视频Meta/006-自制去版权信息插件\|006 Paste cleanup]] |
| Publishing       | Writing a note = updating the blog     | [[en/7.shared/视频Meta/005-写笔记=更新博客\|005 Quartz blog]]                                                   |
| The whole bundle | A download-and-go template vault       | [[en/7.shared/视频Meta/011-obsidian开箱即用模板库\|011 Template vault]], [[en/7.shared/视频Meta/003-代码复制无效的排查\|003 Troubleshooting]] |

Below, each stage in pipeline order.

---

## 1. Capture

Everything starts the second Obsidian opens. The **Homepage plugin** makes every launch land on a dashboard page, and that page does exactly one job: **reduce capture friction** — when an idea strikes, you don't dig through folders for a file; one button takes you straight there.

Five modules:

- **Quick actions** — one click to open today's note, create a project, create a task, or import a book;
- **Quick navigation** — frequently used pages arranged into multi-column cards by scenario;
- **Active projects** — Dataview dynamically lists what's in flight;
- **Frequent templates** — entry points for high-frequency templates;
- **Heatmaps** — activity and word-count heatmaps side by side, showing the rhythm of sustained output.

The whole page is just **a Markdown file + plugins (Homepage / Dataview / Templater / Contribution Graph) + one scoped block of CSS** — no theme-private APIs, so switching themes won't break it. Details in [[en/7.shared/视频Meta/010-Obsidian homepage|episode 010]].

---

## 2. Daily execution

Each day's workbench is a daily note generated from a template. The core design: **a new day opens ready to go, with nothing to tidy up by hand**:

- **Today's goals** — three at most. More breeds anxiety; fewer brings focus;
- **Yesterday's unfinished** — goals left undone roll in automatically, and the lookup **walks back** to the last day that has a record, so skipping a few days is fine — each item is tagged "from XX (N days ago)";
- **Scheduled** — pulled from a planning doc, showing only tasks due today or earlier; the future doesn't interrupt you early;
- **Today's log** — stray thoughts, captured as they come;
- **Today's review / tomorrow's goals** — filled in at day's end; tomorrow's goals automatically become tomorrow's "today's goals".

The rollover logic is implemented in Dataviewjs, with **automatic deduplication** across blocks — the same item never shows up twice. Why not the off-the-shelf Rollover Daily Todos plugin? Because it dumps all tasks into one pile and doesn't support Scheduled recurring tasks — see the Q&A in [[en/7.shared/视频Meta/001-自动继承昨日任务|episode 001]].

---

## 3. Project progress

> The scariest thing about projects isn't having too many tasks — it's opening the laptop the next day and burning half of it just remembering where you left off.

So long-running projects get their own three-layer structure:

1. **Project** — created from the project template, metadata filled in automatically;
2. **Task** — hangs under a project; when created from the task template, **the project name, title, and sequence number all fill themselves in** (Templater's `tp.system.prompt()` + prefix matching, auto-filed into the right folder);
3. **try** — the key design: every task can record multiple attempts. What the first attempt did and where it got stuck, how the second one finished — all auto-arranged into the task's timeline. However long you're away, you know exactly where you stopped.

Two summary pages round it out: a **project overview** (every project with status and progress) and a **task overview** (filterable by project, with completion rates). The division of labor with the daily system is clean — the long-cycle system manages a project's lifecycle; the daily system manages which few things you do today. Details in [[en/7.shared/视频Meta/008-项目管理|episode 008]] and [[en/7.shared/视频Meta/002-模版自动归档、命名与编号|episode 002]].

---

## 4. Periodic review

Everything recorded above converges into a weekly review. Most people use AI for reviews backwards: they shoulder the heaviest part themselves — recalling and compiling — and hand AI only the lightest part, the summarizing. This system flips the whole flow:

> [!tip] The core formula
> **Review quality = source material × prompt**

**The material side**: hook the vault up to a git repo that auto-commits every hour, and you get an evidence chain from three data sources — the todo files (what you **planned** to do), the git log (what you **actually** touched), and `git diff --stat` (how much went into each direction). The gap between todo and git is precisely where a review should dig deepest.

**The prompt side**: write your long-term goals and personality traits into the prompt, and have it **append newly discovered patterns** after every review — a living document that understands you better each time it's used. The `update-growth.py` script automatically moves each week's "patterns / blind spots" into a growth profile.

It all closes into a single `/weekly-review` command: the AI reads the journal, runs git, generates the review against the framework, archives it, and updates the growth profile — **one sentence, end to end**. Full build guide in [[en/7.shared/视频Meta/009-一个指令，让AI 自动生成周复盘|episode 009]].

---

## 5. Content intake

Two small things on the input side:

- **Personal library / watch list** — one-click metadata import via Book Search / Media DB / Douban plugins, with Dataview powering the bookshelf and watch-list views; for the workaround when Douban's hotlink-protected images die, and query patterns that handle both local images and remote URLs, see [[en/7.shared/视频Meta/007-自建个人专属图书馆,douban图片链接失效怎么办|episode 007]];
- **Paste cleanup** — my own Paste Optimizer plugin strips copyright boilerplate and quotes from copied text in one go, see [[en/7.shared/视频Meta/006-自制去版权信息插件|episode 006]].

---

## 6. Publishing

Notes shouldn't end their lives sitting in the vault. **Obsidian + Quartz + Cloudflare Pages** turns "writing a note" and "updating the blog" into the same action: push your notes and the site builds and deploys itself, entirely free — with a private-repo setup to keep anything you don't want public on your own machine. The site you're reading right now runs exactly this way; see [[en/7.shared/视频Meta/005-写笔记=更新博客|episode 005]].

---

## 7. The whole bundle

All of the above is packaged into a **download-and-go template vault** — a replica of my daily main vault with private content removed, one sample note plus matching templates per area, and plugins, CSS snippets, and hotkeys pre-configured.

> [!tip] Repo
> 👉 **[Download the vault (ZIP)](https://count.jz21.eu.org/dl/vault)** ([GitHub repo](https://github.com/jady21a/obsidian-workflow-vault))
>
> Unzip, then open with Obsidian's "Open folder as vault". Getting started takes three small things: create your first daily note, create your first project, import your first book. Details in [[en/7.shared/视频Meta/011-obsidian开箱即用模板库|episode 011]].

If you're building it by hand from the videos and hit "I copied the code but nothing happens", the troubleshooting method is in [[en/7.shared/视频Meta/003-代码复制无效的排查|episode 003]].

---

## Closing

Looking back, no piece of this workflow is a "big project" — every episode solved one small, concrete friction: files slow to find, tasks copied by hand, projects losing the thread, reviews running on memory, publishing being a chore. But once they're strung together, the system starts running itself:

- You just **write** — rollover, filing, numbering, and carry-over are all automatic;
- You just **work** — git quietly keeps the receipts in the background;
- One `/weekly-review` a week, and the AI spots your patterns before you do;
- Every time you finish a note, the blog is already updated.

It's not the standard answer — it's a **starting point that runs out of the box**. Folder names, template fields, Dataview queries are all yours to reshape around your habits. Once reshaped, it's completely yours.
