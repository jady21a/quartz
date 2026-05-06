---
cssclasses:
  - cards
---


## 正在观看
```dataview
table without ID
	file.link as "list",
	choice(contains(封面, "http"), "![|100](" + 封面 + ")", "![[" + 封面 + "|100]]") as 封面,
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

from "2.Read/douban"  OR "2.Read/media-DB" 
SORT 添加时间 desc
where contains(state,"正在观看")
```



## 待看


```dataview
table without ID
	file.link as "list",
	choice(contains(封面, "http"), "![|100](" + 封面 + ")", "![[" + 封面 + "|100]]") as 封面,
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

from "2.Read/douban" OR "2.Read/media-DB" 
where contains(state,"待看")
```




## before
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

from "2.Read/douban"  and #movies
SORT 添加时间 desc
where contains(state,"已看")
```

## 已看
```dataviewjs
const pages = dv.pages('"2.Read/douban" or "2.Read/media-DB"')
    .where(p => p.state && String(p.state).includes("已看") && p.file.tags.includes("#movies"))
    .sort(p => p["添加时间"], 'desc');

function renderCover(cover) {
    if (!cover) return "";
    const s = String(cover);
    if (s.startsWith("http://") || s.startsWith("https://")) return `<img src="${s}" width="100"/>`;
    const file = app.vault.getAbstractFileByPath(s);
    if (file) return `<img src="${app.vault.getResourcePath(file)}" width="100"/>`;
    const m = s.match(/\[\[(.+?)(\|.*)?\]\]/);
    if (m) { const f = app.metadataCache.getFirstLinkpathDest(m[1], ""); if (f) return `<img src="${app.vault.getResourcePath(f)}" width="100"/>`; }
    return s;
}

dv.table(
["list","封面","star","score","myRate","originalTitle","aliases","genre","datePublished","director","state","country"],
    pages.map(p => [
    p.file.link, 
    renderCover(p["封面"]),
    "star:"+p.scoreStar, 
    "score:"+p.score, 
    "myRate:"+p.myRate, 
    "originalTitle:"+p.originalTitle, 
    "aliases:"+p.aliases, 
    "genre:"+p.genre, 
    "datePublished:"+p.datePublished, 
    "director:"+p.director, 
    "state:"+p.state, 
    "country:"+p.country]));
```



## 待看

```dataview
TABLE WITHOUT ID
	file.link AS List,
	choice(封面, choice(contains(封面, "http"), "![|100](" + 封面 + ")", "![[" + 封面 + "|100]]"), choice(image, choice(contains(image, "http"), "![|100](" + image + ")", "![[" + image + "|100]]"), "")) AS Cover,
	choice(scoreStar, "star:" + scoreStar, "") AS Stars,
	choice(score, "score:" + score, choice(onlineRating, "score:" + string(onlineRating), "")) AS Score,
	choice(myRating, "myRate:" + string(myRating), choice(personalRating, "myRate:" + string(personalRating), "")) AS MyRate,
	choice(originalTitle, "original:" + originalTitle, choice(englishTitle, "original:" + englishTitle, "")) AS OriginalTitle,
	choice(aliases, "aliases:" + join(filter(aliases, (x) => x), ", "), "") AS Aliases,
	choice(genre, "genre:" + genre, choice(genres, "genre:" + join(filter(genres, (x) => x), ", "), "")) AS Genre,
	choice(datePublished, "published:" + datePublished, choice(premiere, "published:" + premiere, "")) AS Published,
	choice(director, "director:" + join(filter(director, (x) => x), ", "), "") AS Director,
	choice(state, "state:" + state, choice(watched = false, "state:待看", "")) AS State,
	choice(country, "country:" + join(filter(country, (x) => x), ", "), "") AS Country
FROM "2.Read/douban" OR "2.Read/media-DB"
WHERE (
	contains(file.etags, "#movies") OR
	contains(file.etags, "#mediaDB/tv/movie")
) AND (
	contains(state, "待看") OR
	watched = false
)
SORT 添加时间 DESC
```

