---
cssclasses: 
- cards 
---


## 正在阅读
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"开始阅读："+开始阅读,
	"结束阅读："+结束阅读
from "douban" 
where contains(阅读状态,"正在阅读")

```





## 已读完
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"开始阅读："+开始阅读,
	"结束阅读："+结束阅读
from "douban" 
where contains(阅读状态,"已读完")

```

## 未开始

```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"开始阅读："+开始阅读,
	"结束阅读："+结束阅读
from "douban" 
where contains(阅读状态,"未开始")

```


## 未读完
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"开始阅读："+开始阅读,
	"结束阅读："+结束阅读
from "douban" 
where contains(阅读状态,"未读完")

```

## all
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"author:"+author,
	"star:"+scoreStar,
	"score:"+score,
	"myRate:"+myRate,
	"阅读状态："+阅读状态,
	"totalPage:"+totalPage,
	"currentPage:"+currentPage,
	"开始阅读："+开始阅读,
	"结束阅读："+结束阅读
from "douban" & #book


```


