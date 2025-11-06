---
cssclasses:
- cards
---
## 待看
unforgiven 0
the account
Goodfellas. 2
Casino 3
1923 4
A few good men。1
babe 5
Napoleon Dynamite6
DaVinci Code7
篮坛怪杰
Bourne Identity
分裂
天兆
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"star:"+scoreStar,
	"score:"+score,
	"myRate:"+myRate,
	"originalTitle:"+originalTitle,
	"aliases:"+aliases,
	"genre:"+genre,
	"datePublished:"+datePublished,
	"director:"+director,
	"state:"+state,
	"country:"+country

from "7.Read/douban" and #movies
where contains(state,"未看")
```



## 已看
```dataview
table without ID
	file.link as "list",
	("![|100]("+封面+")") as 封面,
	"star:"+scoreStar,
	"score:"+score,
	"myRate:"+myRate,
	"originalTitle:"+originalTitle,
	"aliases:"+aliases,
	"genre:"+genre,
	"datePublished:"+datePublished,
	"director:"+director,
	"state:"+state,
	"country:"+country

from "7.Read/douban"  and #movies
SORT 添加时间 desc
where contains(state,"已看")
```