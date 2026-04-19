---
originalTitle: "Logic: A Very Short Introduction"
CNTitle:
  - 逻辑学简短入门
author: Graham Priest
genre: Mathematics
publisher: Oxford Paperbacks
publishDate: 2000-10-12
totalPage: "152"
currentPage:
tags:
  - book
isbn: "9780192893208"
封面: http://books.google.com/books/content?id=1-4BLLgo0A8C&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api
阅读状态:
  - 正在阅读
  - 已读完
阅读进度:
添加时间: 2026-01-23
开始阅读:
结束阅读:
myRate:
desc: Logic is often perceived as having little to do with the rest of philosophy, and even less to do with real life. Graham Priest explores the philosophical roots of the subject, explaining how modern formal logic addresses many issues.
---


# 总结笔记
## a.书籍观点


## b.自我总结


## c.永久笔记



# prepare
一、主题


二、阅读疑问
**读前疑问**
1. 逻辑学主要有哪些内容
2. 怎么知道推论是否正确


**读时疑问**


三、新知识


四、overview


五、作者推荐

# 阅读笔记
## 逻辑词汇
真的T(ture)  假的F(false)
真值(_truth values_):真值可以为T,也可以为F
**推断**（_inferences_）: 因为A...所以推断出B
**有效性**（_validity_）: 不管A的真假,只要能由A推出B就是有效的
**演绎有效的**（_deductively valid_）: A真⇄B真
**归纳有效的**（_inductively valid_）: A真——B不一定真
空洞有效:前提为假 → 无法出现前提真但结论假的情况 → 没有反例 → 命题为真

与∧ 或∨ 非-
- 蕴含（如果…那么…）：**→**
- 等价（当且仅当）：**↔ / ⇔**
- 异或（XOR）：**⊕**
任意(∀) 存在(∃)
必然为真(□ ) 可能为真 (◊)
## 一、从什么可以推出什么
与∧(交集)  都真才真
或∨(并集)  都假才假
非(取反)-

真值表

| A   | B   | A∧B | A∨B | -A  |
| --- | --- | --- | --- | --- |
| T   | T   | T   | T   | F   |
| T   | F   | F   | T   | F   |
| F   | T   | F   | T   | T   |
| F   | F   | F   | F   | T   |

|p|q|p → q|p ↔ q|p ⊕ q|
|---|---|---|---|---|
|T|T|T|T|F|
|T|F|F|F|T|
|F|T|T|F|T|
|F|F|T|T|F|


### 既真又假
假设某人说：
> 我正在说的这句话是假的。

称这句话为 λλ。λλ 是真是假呢？如果它为真，那么它所说的就是实际情况，因此 λλ 为假。但如果它为假，由于这恰好就是它所声称的，它就为真。不管哪种情况，λλ 似乎既真又假。该语句就像一条莫比乌斯带，这种拓扑结构由于一个扭转，使得带子的内部就是外部，外部就是内部，而在这里，真就是假，假就是真。

类似的还有
> 我正在说的这句话是真的。

如果它为真，它就为真，因为这就是它所说的。如果它为假，它就为假，因为它说自己为真。因此，假定它为真和假定它为假似乎都是一致的。此外，似乎没有其他事实可以解决其真值问题。并不是它有某个我们不知道，甚或无法知道的值，而是似乎完全没有什么东西能确定其为真或为假。它似乎既不真又不假。
  
句子可以为真，为假，既真又假，或既不真又不假。