// quartz/components/scripts/bookQuery.inline.ts
// 这个脚本在浏览器中执行，动态加载和渲染书籍

interface Book {
    file: string
    title: string
    封面: string
    originalTitle: string
    author: string
    scoreStar: string
    score: string
    publishDate: string
    myRate: string
    阅读状态: string
    totalPage: string
    currentPage: string
    添加时间: string
    结束阅读: string
  }
  
  // 计算阅读进度百分比
  function calculateProgress(current: string, total: string): number {
    const curr = parseInt(current) || 0
    const tot = parseInt(total) || 1
    return Math.round((curr / tot) * 100)
  }
  
  // 计算阅读天数
  function calculateDays(start: string, end: string): number {
    if (!start) return 0
    const startDate = new Date(start)
    const endDate = end ? new Date(end) : new Date()
    const diff = endDate.getTime() - startDate.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }
  
  // 渲染单个书籍卡片
  function renderBookCard(book: Book): string {
    const progress = calculateProgress(book.currentPage, book.totalPage)
    const days = calculateDays(book.添加时间, book.结束阅读)
    
    return `
      <div class="book-card" data-status="${book.阅读状态}">
        <div class="book-header">
          <div class="book-cover-wrapper">
            ${book.封面 ? `<img src="${book.封面}" alt="${book.title}" class="book-cover" loading="lazy">` : '<div class="book-cover-placeholder">📚</div>'}
          </div>
          <div class="book-title-section">
            <h3 class="book-title">
              <a href="${book.file}">${book.title}</a>
            </h3>
            ${book.score ? `
              <div class="book-rating">
                <span class="stars">${book.scoreStar || '⭐'.repeat(Math.floor(parseFloat(book.score) / 2))}</span>
                <span class="score">${book.score}</span>
              </div>
            ` : ''}
            ${book.myRate ? `<div class="my-rating">我的评分: ${book.myRate}/5</div>` : ''}
          </div>
        </div>
        
        <div class="book-info">
          ${book.originalTitle ? `<div class="info-row"><span class="label">原名:</span><span>${book.originalTitle}</span></div>` : ''}
          ${book.author ? `<div class="info-row"><span class="label">作者:</span><span>${book.author}</span></div>` : ''}
          ${book.publishDate ? `<div class="info-row"><span class="label">出版:</span><span>${book.publishDate}</span></div>` : ''}
          ${book.添加时间 ? `<div class="info-row"><span class="label">开始:</span><span>${book.添加时间}</span></div>` : ''}
          ${book.结束阅读 ? `<div class="info-row"><span class="label">完成:</span><span>${book.结束阅读}</span></div>` : ''}
          ${days > 0 ? `<div class="info-row"><span class="label">用时:</span><span>${days} 天</span></div>` : ''}
          ${book.totalPage ? `<div class="info-row"><span class="label">进度:</span><span>${book.currentPage || 0}/${book.totalPage} 页</span></div>` : ''}
        </div>
        
        ${book.totalPage && book.阅读状态 !== '已完成' ? `
          <div class="book-progress">
            <div class="progress-bar" style="width: ${progress}%"></div>
          </div>
          <div class="progress-text">${progress}%</div>
        ` : ''}
        
        <span class="book-status status-${book.阅读状态.replace(/\s/g, '-')}">${book.阅读状态}</span>
      </div>
    `
  }
  
  // 渲染样式
  function injectStyles() {
    if (document.getElementById('book-query-styles')) return
    
    const style = document.createElement('style')
    style.id = 'book-query-styles'
    style.textContent = `
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
        position: relative;
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
      
      .book-cover-wrapper {
        flex-shrink: 0;
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
      
      .book-title-section {
        flex: 1;
        min-width: 0;
      }
      
      .book-title {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
        color: #1f2937;
        line-height: 1.4;
      }
      
      .book-title a {
        text-decoration: none;
        color: inherit;
        word-wrap: break-word;
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
        line-height: 1.6;
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
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .status-正在阅读 {
        background: #dbeafe;
        color: #1e40af;
      }
      
      .status-已完成 {
        background: #d1fae5;
        color: #065f46;
      }
      
      .status-想读 {
        background: #fef3c7;
        color: #92400e;
      }
      
      .book-query-loading {
        text-align: center;
        padding: 2rem;
        color: #6b7280;
      }
      
      .book-query-error {
        text-align: center;
        padding: 2rem;
        color: #dc2626;
        background: #fee2e2;
        border-radius: 8px;
      }
      
      @media (prefers-color-scheme: dark) {
        .book-card {
          background: #1f2937;
          border-color: #374151;
        }
        
        .book-title {
          color: #f9fafb;
        }
        
        .book-info {
          color: #d1d5db;
        }
        
        .info-row .label {
          color: #9ca3af;
        }
      }
    `
    document.head.appendChild(style)
  }
  
  // 主查询函数
  async function loadAndRenderBooks() {
    const containers = document.querySelectorAll('[data-book-query]')
    
    if (containers.length === 0) return
    
    injectStyles()
    
    for (const container of containers) {
      const status = container.getAttribute('data-status')
      const sortBy = container.getAttribute('data-sort') || '添加时间'
      const order = container.getAttribute('data-order') || 'DESC'
      
      container.innerHTML = '<div class="book-query-loading">📚 加载书籍中...</div>'
      
      try {
        const response = await fetch('/book-index.json')
        if (!response.ok) throw new Error('Failed to load book index')
        
        let books: Book[] = await response.json()
        
        // 过滤
        if (status) {
          books = books.filter(book => book.阅读状态 === status)
        }
        
        // 排序
        books.sort((a, b) => {
          const aVal = a[sortBy as keyof Book] || ''
          const bVal = b[sortBy as keyof Book] || ''
          const comparison = aVal > bVal ? 1 : -1
          return order === 'DESC' ? -comparison : comparison
        })
        
        // 渲染
        if (books.length === 0) {
          container.innerHTML = '<div class="book-query-error">😔 没有找到书籍</div>'
        } else {
          const html = `
            <div class="book-grid">
              ${books.map(renderBookCard).join('')}
            </div>
          `
          container.innerHTML = html
        }
      } catch (error) {
        console.error('Error loading books:', error)
        container.innerHTML = `
          <div class="book-query-error">
            ❌ 加载失败<br>
            <small>请确保已运行 npm run generate-books</small>
          </div>
        `
      }
    }
  }
  
  // 监听页面导航
  document.addEventListener('nav', loadAndRenderBooks)
  
  // 初始加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRenderBooks)
  } else {
    loadAndRenderBooks()
  }