


https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/

# 官网
## dataview type
- table
- list
- task
- calendar
````
```dataview 
table 
```
```dataview
list
```
```dataview
list
from "学习"
```
```dataview
task
```
```dataview 
CALENDAR file.cday
```
```dataview 
TABLE aa, bb AS "BB", cc as "CC" 
```

````


## 元数据

    ---
    alias: "document"
    last-reviewed: 2021-08-17
    thoughts:
      rating: 8
      reviewable: false
    ---
- `alias` is a [text](https://blacksmithgu.github.io/obsidian-dataview/annotation/types-of-metadata/#text), because its wrapped in ""
- `last-reviewed` is a [date](https://blacksmithgu.github.io/obsidian-dataview/annotation/types-of-metadata/#date), because it follows the ISO date format
- `thoughts` is a [object](https://blacksmithgu.github.io/obsidian-dataview/annotation/types-of-metadata/#object) field, because it uses the YAML Frontmatter object syntax

## data type
- data

date1:: 2021-02-26T15:15
date2:: 2021-04-17 18:00
```dataview
TABLE date1, date2 WHERE file = this.file 
```


## query
###  Choose a Output Format
````
Lists all pages in your vault as a bullet point list
```dataview
LIST
```

Lists all tasks (completed or not) in your vault
```dataview
TASK
```

Renders a Calendar view where each page is represented as a dot on its creation date.
```dataview
CALENDAR file.cday
```

Shows a table with all pages of your vault, their field value of due, the files' tags and an average of the values of multi-value field working-hours
```dataview
TABLE due, file.tags AS "tags", average(working-hours)
```

````

### Choose your source
````
Lists all pages inside the folder Books and its sub folders
```dataview
LIST
FROM "Books"
```

Lists all pages that include the tag #status/open or #status/wip
```dataview
LIST
FROM #status/open OR #status/wip
```

Lists all pages that have either the tag #assignment and are inside folder "30 School" (or its sub folders), or are inside folder "30 School/32 Homeworks" and are linked on the page School Dashboard Current To Dos
```dataview
LIST
FROM (#assignment AND "30 School") OR ("30 School/32 Homeworks" AND outgoing([[School Dashboard Current To Dos]]))
```
````

### Filter, sort, group or limit results
````
Lists all pages that have a metadata field `due` and where `due` is before today
```dataview
LIST
WHERE due AND due < date(today)
```

Lists the 10 most recently created pages in your vault that have the tag #status/open
```dataview
LIST
FROM #status/open
SORT file.ctime DESC
LIMIT 10
```

Lists the 10 oldest and incomplete tasks of your vault as an interactive task list, grouped by their containing file and sorted from oldest to newest file.
```dataview
TASK
WHERE !completed
SORT created ASC
LIMIT 10
GROUP BY file.link
SORT rows.file.ctime ASC
````

## data commands
### from
- `FROM #tag`
- FROM "folder"
- FROM "path/to/file"
- `FROM [[note]]`
### where
- 24h内修改过的文件
	LIST WHERE file.mtime >= date(today) - dur(1 day)
- 找出一个月没动的文件
	LIST FROM #projects WHERE !completed AND file.ctime <= date(today) - dur(1 month)

```dataview
 LIST WHERE file.mtime >= date(today) - dur(1 day)
```

```dataview
LIST  WHERE !completed AND file.ctime <= date(today) - dur(1 month)
```


### sort
- `SORT date [ASCENDING/DESCENDING/ASC/DESC]`
- `SORT field1 [ASCENDING/DESCENDING/ASC/DESC], ..., fieldN [ASC/DESC]`

### group by
- GROUP BY field 
- GROUP BY (computed_field) AS name

### flatten
- FLATTEN field 
- FLATTEN (computed_field) AS name

### limit
Restrict the results to at most N values.
- LIMIT 5