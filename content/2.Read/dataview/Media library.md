---
cssclasses:
  - cards
---

## 正在观看

```dataview
TABLE WITHOUT ID
	file.link AS List,
	choice(封面, "![|100](" + 封面 + ")", choice(image, "![|100](" + image + ")", "")) AS Cover,
	choice(scoreStar, "star:" + scoreStar, "") AS Stars,
	choice(score, "score:" + score, choice(onlineRating, "score:" + string(onlineRating), "")) AS Score,
	choice(myRating, "myRate:" + string(myRating), choice(personalRating, "myRate:" + string(personalRating), "")) AS MyRate,
	choice(originalTitle, originalTitle, englishTitle) AS OriginalTitle,
	aliases AS Aliases,
	choice(genre, genre, genres) AS Genre,
	choice(datePublished, datePublished, premiere) AS Published,
	director AS Director,
	state AS State,
	country AS Country
FROM "2.Read/douban" OR "2.Read/media-DB"
WHERE (
	contains(file.etags, "#movies") OR
	contains(file.etags, "#mediaDB/tv/movie")
) AND (
	contains(state, "正在观看") OR
	contains(state, "在看")
)
SORT 添加时间 DESC
```

## 待看

```dataview
TABLE WITHOUT ID
	file.link AS List,
	choice(封面, "![|100](" + 封面 + ")", choice(image, "![|100](" + image + ")", "")) AS Cover,
	choice(scoreStar, "star:" + scoreStar, "") AS Stars,
	choice(score, "score:" + score, choice(onlineRating, "score:" + string(onlineRating), "")) AS Score,
	choice(myRating, "myRate:" + string(myRating), choice(personalRating, "myRate:" + string(personalRating), "")) AS MyRate,
	choice(originalTitle, originalTitle, englishTitle) AS OriginalTitle,
	aliases AS Aliases,
	choice(genre, genre, genres) AS Genre,
	choice(datePublished, datePublished, premiere) AS Published,
	director AS Director,
	choice(state, state, choice(watched = false, "待看", "")) AS State,
	country AS Country
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

## 已看

```dataview
TABLE WITHOUT ID
	file.link AS List,
	choice(封面, "![|100](" + 封面 + ")", choice(image, "![|100](" + image + ")", "")) AS Cover,
	choice(scoreStar, "star:" + scoreStar, "") AS Stars,
	choice(score, "score:" + score, choice(onlineRating, "score:" + string(onlineRating), "")) AS Score,
	choice(myRating, "myRate:" + string(myRating), choice(personalRating, "myRate:" + string(personalRating), "")) AS MyRate,
	choice(originalTitle, originalTitle, englishTitle) AS OriginalTitle,
	aliases AS Aliases,
	choice(genre, genre, genres) AS Genre,
	choice(datePublished, datePublished, premiere) AS Published,
	director AS Director,
	choice(state, state, choice(watched = true, "已看", "")) AS State,
	country AS Country
FROM "2.Read/douban" OR "2.Read/media-DB"
WHERE (
	contains(file.etags, "#movies") OR
	contains(file.etags, "#mediaDB/tv/movie")
) AND (
	contains(state, "已看") OR
	watched = true
)
SORT 添加时间 DESC
```
