````
<%*
// 分流入口:分类 = a2 → 视频任务模板(task-video - template);其余分类走下方通用流程。
// 注意:本文件不能出现静态文本——a2 分支 include 后 return,但静态文本不受 return
// 控制、会照样拼进输出,所以通用内容也全部经 tR 拼接。
// 1. 输入类型
const type = await tp.system.prompt("task 分类", "");
// 取消则删除刚创建的文档
if (type === null) {
  await app.vault.trash(tp.config.target_file, true);
  return;
}

// a2 默认视频任务,整体交给视频模板渲染(独立文件,单独维护)
if (type === "a2") {
  tR += await tp.file.include("[[task-video - template]]");
  return;
}

// 2. 自动匹配同名 project
let matchedProject = "";
const projectFiles = app.vault.getFiles()
  .filter(f => f.path.startsWith("4.Projects/I.projects/"));
for (const f of projectFiles) {
  const meta = app.metadataCache.getFileCache(f)?.frontmatter;
  if (meta?.project?.startsWith(type)) {
    matchedProject = f.basename;
    break;
  }
}

// 3. 扫描 Projects/ 计算当前 type 的最大序号
const existing = app.vault.getFiles()
  .filter(f => f.path.startsWith("4.Projects/II.tasks") && f.name.startsWith(type + "-"));
let maxNum = 0;
for (const f of existing) {
  const m = f.name.match(new RegExp(`^${type}-(\\d+)-`));
  if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
}
const seq = String(maxNum + 1).padStart(3, "0");

// 4. 输入短标题
const shortTitle = await tp.system.prompt("标题 (short-title)");
// 取消则删除刚创建的文档
if (shortTitle === null) {
  await app.vault.trash(tp.config.target_file, true);
  return;
}

// 5. 组合文件名并移动
await tp.file.move("4.Projects/II.tasks/" + `${type}-${seq}-${shortTitle}`);

// 6. 通用任务笔记内容
tR += `---
project: ${matchedProject}
sub-project: 子项目-${shortTitle}
type:  sub-project
seq: ${seq}
date: ${tp.date.now("YYYY-MM-DD")}
completion: 
mood: 
status:
  - 进行中
tags:
  - task
详情:
check:
try:
---


## try

\`\`\`dataviewjs
const rows = (dv.current().try || [])
  .filter(b => b && b["做了什么/没做的话为什么/想法"]?.trim())
  .map(b => [b.日期, b.完成度, b.心情, b["做了什么/没做的话为什么/想法"]]);

if (rows.length > 0) {
  dv.table(["日期", "完成度", "心情", "内容"], rows);
}
\`\`\`


## 任务列表


## 记录
`;
-%>

````