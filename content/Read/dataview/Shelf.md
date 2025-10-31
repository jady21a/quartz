---
cssclasses:
- cards
---

## 正在阅读

```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"originalTitle:"+originalTitle,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"publishDate:"+publishDate,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"添加时间："+添加时间,
	"结束阅读："+结束阅读,
	"阅读用时:"+(date(结束阅读) - date(添加时间))
from "Read/douban" 

SORT 添加时间 DESC
where contains(阅读状态,"正在阅读")

```



## 已读完
```dataviewjs
let books = dv.pages("#book")
    .where(b => b.阅读状态 == "已读完")
    .sort(b => b.结束阅读, 'asc'); // 升序
dv.paragraph("📚 已读完数量：" + books.length);

```
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"originalTitle:"+originalTitle,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"publishDate:"+publishDate,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"添加时间："+添加时间,
	"结束阅读："+结束阅读,
	"阅读用时:"+(date(结束阅读) - date(添加时间))
from "Read/douban" 
SORT 结束阅读 desc //asc
where contains(阅读状态,"已读完")

```

## 未开始
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"originalTitle:"+originalTitle,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"publishDate:"+publishDate,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"添加时间："+添加时间,
	"结束阅读："+结束阅读
from "Read/douban" 
where contains(阅读状态,"未开始")

```


## 未读完
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"originalTitle:"+originalTitle,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"publishDate:"+publishDate,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"添加时间："+添加时间,
	"结束阅读："+结束阅读
from "Read/douban" 
where contains(阅读状态,"未读完")

```


## 概览
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"originalTitle:"+originalTitle,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"publishDate:"+publishDate,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"添加时间："+添加时间,
	"结束阅读："+结束阅读,
	"阅读用时:"+(date(结束阅读) - date(添加时间))
from "Read/douban" 
SORT 结束阅读 desc //asc
where contains(阅读状态,"概览")

```
## 书库
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"originalTitle:"+originalTitle,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"publishDate:"+publishDate,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"添加时间："+添加时间,
	"结束阅读："+结束阅读
from "Read/douban"  & #book


```