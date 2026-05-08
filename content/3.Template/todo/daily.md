```
---
目标完成度:
锻炼:
阅读:
语言:
睡觉习惯:
date: <% tp.date.now("YYYY-MM-DD") %>
---
<%*
const MAX_DAYS = 30;
let tomorrowGoals = "";
let yesterdayGoals = "";
let dedupedUnfinished = "";
let daysAgo = 0;
let foundDate = null;

for (let i = 1; i <= MAX_DAYS; i++) {
    const targetDate = moment().subtract(i, 'days').format('YYYY-MM-DD');
    const targetFile = tp.file.find_tfile(targetDate);

    if (targetFile) {
        const content = await tp.file.include("[[" + targetDate + "]]");

        const goalMatch = content.match(/## 明日目标\n([\s\S]*?)(?=\n## |\n---|\n#[^#]|$)/);
        tomorrowGoals = goalMatch
    ? goalMatch[1].split('\n').filter(l => l.trim() !== '-' && l.trim() !== '- ').join('\n').trim()
    : "";

        const todayMatch = content.match(/## 今日目标\n([\s\S]*?)(?=\n## |\n---|\n#[^#]|$)/);
        yesterdayGoals = todayMatch
            ? todayMatch[1].split('\n').filter(l => /^- \[ \] .+/.test(l)).join('\n')
            : "";

        const unfinished = content
            .split('\n')
            .filter(line => line.match(/^- \[ \] .+/))
            .join('\n');

        if (tomorrowGoals || unfinished || yesterdayGoals) {
            const tomorrowLines = new Set([
                ...tomorrowGoals.split('\n').map(l => l.trim()),
                ...yesterdayGoals.split('\n').map(l => l.trim()),
            ]);
            dedupedUnfinished = unfinished
                .split('\n')
                .filter(line => !tomorrowLines.has(line.trim()))
                .join('\n');

            daysAgo = i;
            foundDate = targetDate;
            break;
        }
    }
}

const dateHint = daysAgo > 1 ? `<!-- 来自 ${foundDate},${daysAgo} 天前 -->` : "";
const todayGoals = tomorrowGoals || "- [ ] ";
const carriedBlock = dedupedUnfinished ? dedupedUnfinished : "(无延续任务)";
-%>
<% tp.date.now("YYYY-MM-DD") %>
## 今日目标
<% todayGoals %>

## 昨日目标
<% yesterdayGoals || "(无昨日未完成目标)" %>

## scheduled
```dataviewjs
const date = dv.date(dv.current().file.name);
if (date) {
  const scheduledTasks = dv.pages().file.tasks
    .where(t => !t.completed && t.scheduled && t.scheduled <= date)
    .sort(t => t.scheduled, 'asc');

  const todayTasks = scheduledTasks.where(t => t.scheduled.equals(date));
  const carriedTasks = scheduledTasks.where(t => t.scheduled < date);

  if (todayTasks.length > 0) {
    dv.header(3, "今日 schedule");
    dv.taskList(todayTasks);
  }

  if (carriedTasks.length > 0) {
    dv.header(3, "延续 schedule");
    const lines = carriedTasks.map(t => {
      const scheduledDate = t.scheduled.toFormat("yyyy-MM-dd");
      return `- [ ] ${t.text}  [scheduled:: ${scheduledDate}]`;
    });
    dv.paragraph(lines.join("\n"));
  }

  if (todayTasks.length === 0 && carriedTasks.length === 0) {
    dv.paragraph("(无 scheduled 任务)");
  }
}
```

## 延续目标
<% daysAgo > 1 ? `> [!note] 来自 ${foundDate}(${daysAgo} 天前)\n\n` + carriedBlock : carriedBlock %>

## 今日复盘
- 做了什么:
- 没做的话为什么:
- 今日亮点:
- 想法/反思/心情:

## 明日目标
- [ ] 
 
## 今日记录

```