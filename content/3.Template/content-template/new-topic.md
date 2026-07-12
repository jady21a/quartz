<%*
// ── 配置区 ──────────────────────────────
const FOLDER = "7.shared/专题Meta";
// ─────────────────────────────────────────

// 1. 扫描已有文件，找最大编号
const files = app.vault.getFiles()
  .filter(f => f.path.startsWith(FOLDER + "/"));

let maxNum = 0;
for (const f of files) {
  const match = f.name.match(/^(\d+)-/);
  if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
}

// 2. 生成下一个编号（三位补零）
const nextNum = String(maxNum + 1).padStart(3, "0");

// 3. 弹窗输入标题
const title = await tp.system.prompt(`新建第 ${nextNum} 个专题，请输入标题`);
if (!title) { new Notice("已取消"); return; }

const fileName = `${nextNum}-${title}`;

// 4. 移动到目标文件夹并重命名
await tp.file.move(`${FOLDER}/${fileName}`);
_%>
---
title: <% title %>
tags:
  - topic
date: <% tp.date.now("YYYY-MM-DD") %>
category: obsidian
description:
cover:
draft: "true"
---

## <% title %>

> [!abstract] 摘要
>

---

## 正文



---

相关代码:
相关视频:
