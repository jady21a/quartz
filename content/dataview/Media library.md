


---
cssclasses: 
- cards 
---


## 待看
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

from "douban" and #movies
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

from "douban" and #movies
where contains(state,"已看")
```





	