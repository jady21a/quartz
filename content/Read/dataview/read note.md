

## comment

```dataview
list note

from "Read/douban"
where contains(阅读状态,"正在阅读") orcontains(阅读状态,"已完成")

```

```dataview
table without ID
	file.link as "list",
	"阅读状态："+阅读状态,
	"comment:"+comment
from "Read/douban"
where contains(阅读状态,"已读完")
and contains(阅读状态,"正在阅读")
```