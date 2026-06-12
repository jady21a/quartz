````
---
cssclasses:
  - homepage-dashboard
---

## 快捷操作
```dataviewjs
const actions = [
  { label: "今日笔记", shortLabel: "今日笔记", command: "periodic-notes:open-daily-note", variant: "accent", row: "top" },
  { label: "本周总结", shortLabel: "本周总结", command: "periodic-notes:open-weekly-note", variant: "muted", row: "top" },
  { label: "新建 Task", shortLabel: "Task", command: "templater-obsidian:create-10.Template/projects/task - template.md", variant: "dark", row: "bottom" },
  { label: "新建 Project", shortLabel: "Project", command: "templater-obsidian:create-10.Template/projects/项目- template.md", variant: "dark", row: "bottom" },
  { label: "New Book", shortLabel: "Book", command: "obsidian-book-search-plugin:open-book-search-modal", variant: "dark", row: "bottom" },
  { label: "New Movie", shortLabel: "Movie", command: "obsidian-media-db-plugin:open-media-db-search-modal-with-movie", variant: "dark", row: "bottom" },
];

// 命令不存在时(改了模板名/路径、插件没开)给出提示，而不是点了没反应
const runCommand = (action) => {
  const ok = app.commands.executeCommandById(action.command);
  if (!ok) {
    new Notice(`命令未找到，请检查：${action.command}`);
  }
};

const wrap = dv.el("div", "", { cls: "hp-quick-launch" });
const topRow = wrap.createEl("div", { cls: "hp-quick-actions hp-quick-actions-top" });
const bottomRow = wrap.createEl("div", { cls: "hp-quick-links" });

for (const action of actions) {
  if (action.row === "top") {
    const button = topRow.createEl("button", {
      text: action.label,
      cls: `hp-quick-action hp-quick-action-${action.variant}`,
    });
    button.type = "button";
    button.setAttr("aria-label", action.label);
    button.addEventListener("click", () => runCommand(action));
  } else {
    const link = bottomRow.createEl("button", {
      text: action.shortLabel,
      cls: "hp-quick-link",
    });
    link.type = "button";
    link.setAttr("aria-label", action.label);
    link.addEventListener("click", () => runCommand(action));
  }
}
```

## 快速导航
> [!multi-column]
>
>> [!tip]+  阅读
>>  ### #mcl/list-card
>> - [[Shelf]]
>> - [[Media Library]]
>> - [[1_to read]]
>> - [[0_read list 个人成长维度]]
>> - [[2_to watch]]
>> - [[阅读统计]]
>> - [[阅读复习]]
>
>> [!summary]+ 项目
>>  ### #mcl/list-card
>> - [[a1.博客网站]]
>> - [[a2.影响力]]
>> - [[a3.obsidian探索]]
>> - [[a4.项目idea]]
>> - [[a5.AI工作流]]
>> - [[b1.make money]]
>> - [[c1.read]]
>> - [[d1.身体健康]]
>
>> [!warning]+  备忘
>>  ### #mcl/list-card
>> - [[2.obsidian]]
>> - [[5.ai]]
>> - [[剪辑]]
>> - [[tag]]
>> - [[最近删除文件]]
>
>> [!todo]+  Todo
>>  ### #mcl/list-card
>> - [[5.todo/0_view/todo|todo]]
>> - [[draft-todo]]
>> - [[回顾本周]]
>> - [[0.core]]
>> - [[long-term]]
>> - [[schedule-task]]
>> - [[token-todo]]
>> - [[0-fleeting]]


## 常用项目
> [!multi-column]
>
>> [!info]+ Projects
>>  ### #mcl/list-card
>> - [[项目总览]]
>> - [[task总览]]
>> - [[a2-02-视频制作发布SOP]]
>> - [[a2-01-视频可选列表]]
>
>> [!note]+ 最近笔记
>> ```dataview
>> LIST FROM "1.Rough" OR "2.Read" OR "3.learn" OR "4.Projects" OR "5.todo" OR "12.skills" OR "JC-open"
>> SORT file.ctime DESC
>> LIMIT 5
>> ```
>
>> [!todo]+  今日任务
>> ```tasks
>> not done
>> scheduled on today
>> path includes 5.todo
>> hide backlink
>> limit 7
>> ```

## 常用模板
> [!multi-column]
>
>> [!summary]+ 项目模板
>>  ### #mcl/list-card
>> - [[10.Template/projects/项目- template|project模板]]
>> - [[10.Template/projects/task - template|task模板]]
>> - [[10.Template/projects/try|try模板]]
>
>> [!todo]+ 计划模板
>>  ### #mcl/list-card
>> - [[10.Template/todo/daily|Daily]]
>> - [[10.Template/todo/weekly|Weekly]]
>> - [[10.Template/todo/每天任务|每天任务]]
>> - [[10.Template/todo/每天+周任务|每天+周任务]]
>
>> [!tip]+ 书影模板
>>  ### #mcl/list-card
>> - [[book-ch]]
>> - [[book-en]]
>> - [[movie-ch|影视记录]]
>
>> [!info]+ 记录模板
>>  ### #mcl/list-card
>> - [[10.Template/想法验证模版|想法验证]]
>> - [[10.Template/阅读/复习|阅读复习]]
>> - [[10.Template/阅读/复习+prepare|复习准备]]


## 热力图
### 活跃度热力图
```contributionGraph
title: Contributions
graphType: default
dateRangeValue: 1
dateRangeType: LATEST_YEAR
startOfWeek: "0"
showCellRuleIndicators: true
titleStyle:
  textAlign: left
  fontSize: 17px
  fontWeight: normal
dataSource:
  type: PAGE
  value: ""
  dateField:
    type: FILE_MTIME
  filters: []
fillTheScreen: false
enableMainContainerShadow: true
cellStyleRules:
  - id: default_b
    color: "#9be9a8"
    min: 1
    max: 2
  - id: default_c
    color: "#40c463"
    min: 2
    max: 5
  - id: default_d
    color: "#30a14e"
    min: 5
    max: 10
  - id: default_e
    color: "#216e39"
    min: 10
    max: 999
cellStyle:
  minWidth: 12px
  minHeight: 12px

```
### 字数热力图
```dataviewjs
function getYMD(n) {
    var today = new Date();
    var targetday_milliseconds = today.getTime() + 1000 * 60 * 60 * 24 * n;
    today.setTime(targetday_milliseconds);
    var tYear = today.getFullYear();
    var tMonth = ("0" + (today.getMonth() + 1)).slice(-2);
    var tDate = ("0" + today.getDate()).slice(-2);
    return tYear + "-" + tMonth + "-" + tDate;
}

const jsonString = await app.vault.adapter.read(".obsidian/vault-stats.json");
const jsonObject = JSON.parse(jsonString);

// 直接遍历已有记录，有几天画几天(比按天倒推更快，不随空白天数增长)
const data = Object.entries(jsonObject.history)
    .map(([date, v]) => [date, (v && v.words) || 0]);
const earliest = data.length ? data.map((d) => d[0]).sort()[0] : null;

const chartBox = this.container.createEl("div");
chartBox.style.display = "flex";
chartBox.style.justifyContent = "center";

let mode = "year"; // 默认只看当年

function buildOption() {
    let calendarRange = new Date().getFullYear();
    if (mode === "all" && earliest) {
        calendarRange = [earliest, getYMD(0)];
    }
    return {
        backgroundColor: "rgba(0, 0, 0, 0)",
        width: 800,
        height: 250,
        tooltip: {
            position: "top",
            trigger: "item",
            formatter: function (params) {
                return `日期：${params.value[0]}<br>字数：${params.value[1]}`;
            },
        },
        visualMap: {
            type: "piecewise",
            splitNumber: 7,
            orient: "horizontal",
            left: "center",
            top: 0,
            textStyle: { color: "var(--text-normal)" },
            pieces: [
                { value: 0, color: "rgba(0,0,0,0)" }, // 写0字：透明，与空白天一致
                { gt: 0, lte: 60, color: "#deebf7" },     // 最浅蓝（低字数）
                { gt: 60, lte: 150, color: "#c6dbef" },
                { gt: 150, lte: 350, color: "#9ecae1" },
                { gt: 350, lte: 650, color: "#6baed6" },
                { gt: 650, lte: 1500, color: "#3182bd" }, // 深蓝（高字数）
                { gt: 1500, color: "#08519c" },           // 最深蓝（高产日）
            ],
            calculable: true,
        },
        graphic: [
            {
                type: "text",
                right: 16,
                top: 2,
                z: 100,
                cursor: "pointer",
                style: {
                    text: mode === "year" ? "all" : "year",
                    fontSize: 14,
                    fontWeight: "bold",
                    fill: mode === "all" ? "#e67e22" : "#888888",
                },
                onclick: () => {
                    mode = mode === "year" ? "all" : "year";
                    render();
                },
            },
        ],
        calendar: {
            left: 30,
            right: 10,
            range: calendarRange,
            itemStyle: {
                normal: {
                    color: "rgba(0, 0, 0, 0)",
                    borderWidth: 2,
                    borderColor: "rgba(128,128,128,0.2)",
                },
            },
        },
        series: [
            { type: "scatter", coordinateSystem: "calendar", data: data },
        ],
    };
}

function render() {
    chartBox.empty();
    app.plugins.plugins["obsidian-echarts"].render(buildOption(), chartBox);
}

render();

```
```dataviewjs
// === Contribution Graph 版字数热力图（试看；不好看删掉本块即可回退）===
const jsonString = await app.vault.adapter.read(".obsidian/vault-stats.json");
const history = JSON.parse(jsonString).history;
const data = Object.entries(history).map(([date, v]) => ({
    date,
    value: (v && v.words) || 0,
}));

const year = new Date().getFullYear();
const box = this.container.createEl("div");

window.renderContributionGraph(box, {
    title: "字数热力图",
    data,
    graphType: "default",
    fromDate: `${year}-01-01`,
    toDate: `${year}-12-31`,
    startOfWeek: "0",
    showCellRuleIndicators: true,
    enableMainContainerShadow: true,
    titleStyle: { textAlign: "left", fontSize: "17px", fontWeight: "normal" },
    cellStyle: { minWidth: "12px", minHeight: "12px" },
    cellStyleRules: [
        { color: "#deebf7", min: 1, max: 61 },      // 1–60 字
        { color: "#c6dbef", min: 61, max: 151 },    // 61–150
        { color: "#9ecae1", min: 151, max: 351 },   // 151–350
        { color: "#6baed6", min: 351, max: 651 },   // 351–650
        { color: "#3182bd", min: 651, max: 1501 },  // 651–1500
        { color: "#08519c", min: 1501, max: 9999999 }, // 1500+
    ],
});
```


````