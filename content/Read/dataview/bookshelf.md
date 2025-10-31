# 📚 我的书架

<div id="bookshelf"></div>

<script>
fetch('/static/contentIndex.json')
  .then(res = > res.json())
  .then(data => {
    const container = document.getElementById('bookshelf');

    // 只显示正在阅读
    const readingBooks = data.filter(d => d.readingStatus.includes("正在阅读"));

    container.innerHTML = readingBooks.map(d => `
      <div class="book-card">
        <img src="${d.cover}" width="100"/>
        <h3>${d.title}</h3>
        <p>作者: ${d.author}</p>
        <p>评分: ${d.score} | 我的评分: ${d.myRate}</p>
        <p>阅读进度: ${d.currentPage}/${d.totalPage}</p>
        <p>开始: ${d.startDate} | 结束: ${d.endDate || "未完成"}</p>
      </div>
    `).join('');
  });
  readingBooks.sort((a,b) => b.score - a.score);

</script>
