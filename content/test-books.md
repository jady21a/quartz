---
title: 测试书籍展示
---

# 📚 书籍测试页面

<div data-book-query data-status="已读完" data-sort="添加时间" data-order="DESC"></div>

<style>
.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.book-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
}

.book-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.12);
}

.book-header {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.book-cover {
  width: 90px;
  height: 125px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.book-cover-placeholder {
  width: 90px;
  height: 125px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  font-size: 2rem;
}

.book-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

.book-title a {
  text-decoration: none;
  color: inherit;
}

.book-title a:hover {
  color: #2563eb;
}

.book-rating {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.stars {
  color: #f59e0b;
  font-size: 0.9rem;
}

.score {
  font-weight: 600;
  color: #f59e0b;
}

.my-rating {
  font-size: 0.8rem;
  color: #6b7280;
}

.book-info {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.info-row {
  display: flex;
  margin: 0.3rem 0;
}

.info-row .label {
  font-weight: 500;
  min-width: 60px;
  color: #4b5563;
}

.book-progress {
  margin-top: 1rem;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: right;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.book-status {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 1rem;
}

.status-正在阅读 {
  background: #dbeafe;
  color: #1e40af;
}

.status-已读完 {
  background: #d1fae5;
  color: #065f46;
}

.status-未读完 {
  background: #fef3c7;
  color: #92400e;
}

.status-未开始 {
  background: #f3f4f6;
  color: #4b5563;
}

.status-概览 {
  background: #e0e7ff;
  color: #4338ca;
}

.book-query-loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  font-size: 1.2rem;
}

.book-query-error {
  text-align: center;
  padding: 2rem;
  color: #dc2626;
  background: #fee2e2;
  border-radius: 8px;
  margin: 1rem 0;
}
</style>

<script type="module">
console.log('Book query script loaded');

function calculateProgress(current, total) {
  var curr = parseInt(current) || 0;
  var tot = parseInt(total) || 1;
  return Math.round((curr / tot) * 100);
}

function calculateDays(start, end) {
  if (!start) return 0;
  var startDate = new Date(start);
  var endDate = end ? new Date(end) : new Date();
  var diff = endDate.getTime() - startDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function renderBookCard(book) {
  var progress = calculateProgress(book.currentPage, book.totalPage);
  var days = calculateDays(book.添加时间, book.结束阅读);
  
  var html = '<div class="book-card">';
  html += '<div class="book-header">';
  html += '<div class="book-cover-wrapper">';
  
  if (book.封面) {
    html += '<img src="' + book.封面 + '" alt="' + (book.title || '') + '" class="book-cover" loading="lazy">';
  } else {
    html += '<div class="book-cover-placeholder">📚</div>';
  }
  
  html += '</div>';
  html += '<div class="book-title-section">';
  html += '<h3 class="book-title">';
  html += '<a href="' + book.file + '">' + (book.title || '未命名') + '</a>';
  html += '</h3>';
  
  if (book.score) {
    html += '<div class="book-rating">';
    html += '<span class="stars">' + (book.scoreStar || '⭐'.repeat(Math.floor(parseFloat(book.score) / 2))) + '</span>';
    html += '<span class="score">' + book.score + '</span>';
    html += '</div>';
  }
  
  if (book.myRate) {
    html += '<div class="my-rating">我的评分: ' + book.myRate + '/5</div>';
  }
  
  html += '</div></div>';
  
  html += '<div class="book-info">';
  
  if (book.originalTitle) {
    html += '<div class="info-row"><span class="label">原名:</span><span>' + book.originalTitle + '</span></div>';
  }
  if (book.author) {
    html += '<div class="info-row"><span class="label">作者:</span><span>' + book.author + '</span></div>';
  }
  if (book.publishDate) {
    html += '<div class="info-row"><span class="label">出版:</span><span>' + book.publishDate + '</span></div>';
  }
  if (book.添加时间) {
    html += '<div class="info-row"><span class="label">开始:</span><span>' + book.添加时间 + '</span></div>';
  }
  if (book.结束阅读) {
    html += '<div class="info-row"><span class="label">完成:</span><span>' + book.结束阅读 + '</span></div>';
  }
  if (days > 0) {
    html += '<div class="info-row"><span class="label">用时:</span><span>' + days + ' 天</span></div>';
  }
  if (book.totalPage) {
    html += '<div class="info-row"><span class="label">进度:</span><span>' + (book.currentPage || 0) + '/' + book.totalPage + ' 页</span></div>';
  }
  
  html += '</div>';
  
  if (book.totalPage && book.阅读状态 && !book.阅读状态.includes('已读完')) {
    html += '<div class="book-progress">';
    html += '<div class="progress-bar" style="width: ' + progress + '%"></div>';
    html += '</div>';
    html += '<div class="progress-text">' + progress + '%</div>';
  }
  
  var statusClass = (book.阅读状态 || 'Unknown').split(',')[0].replace(/\s/g, '-');
  html += '<span class="book-status status-' + statusClass + '">' + (book.阅读状态 || 'Unknown') + '</span>';
  
  html += '</div>';
  
  return html;
}

async function loadAndRenderBooks() {
  console.log('Looking for book query containers...');
  var containers = document.querySelectorAll('[data-book-query]');
  console.log('Found ' + containers.length + ' containers');
  
  if (containers.length === 0) {
    console.warn('No [data-book-query] elements found');
    return;
  }
  
  for (var i = 0; i < containers.length; i++) {
    var container = containers[i];
    var status = container.getAttribute('data-status');
    var sortBy = container.getAttribute('data-sort') || '添加时间';
    var order = container.getAttribute('data-order') || 'DESC';
    
    console.log('Loading books with status: ' + (status || 'all'));
    container.innerHTML = '<div class="book-query-loading">📚 加载书籍中...</div>';
    
    try {
      console.log('Fetching /book-index.json...');
      var response = await fetch('/book-index.json');
      console.log('Response status: ' + response.status);
      
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
      }
      
      var books = await response.json();
      console.log('Loaded ' + books.length + ' books from index');
      
      if (status) {
        books = books.filter(function(book) {
          var bookStatuses = (book.阅读状态 || '').split(',').map(function(s) { return s.trim(); });
          return bookStatuses.includes(status);
        });
        console.log('Filtered to ' + books.length + ' books with status "' + status + '"');
      }
      
      books.sort(function(a, b) {
        var aVal = a[sortBy] || '';
        var bVal = b[sortBy] || '';
        var comparison = aVal > bVal ? 1 : -1;
        return order === 'DESC' ? -comparison : comparison;
      });
      
      if (books.length === 0) {
        container.innerHTML = '<div class="book-query-error">😔 没有找到状态为"' + (status || '任何') + '"的书籍</div>';
      } else {
        var cardsHtml = books.map(renderBookCard).join('');
        container.innerHTML = '<div class="book-grid">' + cardsHtml + '</div>';
        console.log('Rendered ' + books.length + ' book cards');
      }
    } catch (error) {
      console.error('Error loading books:', error);
      container.innerHTML = '<div class="book-query-error">❌ 加载失败: ' + error.message + '<br><small>请检查浏览器控制台</small></div>';
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded fired');
    loadAndRenderBooks();
  });
} else {
  console.log('DOM already loaded');
  loadAndRenderBooks();
}

document.addEventListener('nav', function() {
  console.log('Navigation event detected');
  setTimeout(loadAndRenderBooks, 100);
});
</script>