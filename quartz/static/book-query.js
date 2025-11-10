// quartz/static/book-query.js
(function() {
    'use strict';
    
    console.log('📚 Book query script loaded');
  
    // ==================== 工具函数 ====================
    
    // 图片代理函数 - 处理豆瓣防盗链
    function proxyImage(imageUrl) {
      if (!imageUrl) return '';
      
      // 检查是否是豆瓣图片
      if (imageUrl.includes('douban.com') || imageUrl.includes('doubanio.com')) {
        // 移除协议前缀（https:// 或 http://）
        const urlWithoutProtocol = imageUrl.replace(/^https?:\/\//, '');
        // 添加尺寸和质量参数优化加载
        return `https://images.weserv.nl/?url=${urlWithoutProtocol}&w=200&h=280&fit=cover&output=webp&q=85`;
      }
      
      return imageUrl;
    }
  
    // 计算阅读进度百分比
    function calculateProgress(current, total) {
      const curr = parseInt(current) || 0;
      const tot = parseInt(total) || 1;
      return Math.round((curr / tot) * 100);
    }
  
    // 计算阅读天数
    function calculateDays(start, end) {
      if (!start) return 0;
      const startDate = new Date(start);
      const endDate = end ? new Date(end) : new Date();
      const diff = endDate.getTime() - startDate.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
  
    // ==================== 渲染函数 ====================
    
    // 渲染单个书籍卡片 - 图一风格：封面+标题在顶部同一列
    function renderBookCard(book) {
      const progress = calculateProgress(book.currentPage, book.totalPage);
      const days = calculateDays(book.添加时间, book.结束阅读);
      
      const card = document.createElement('div');
      card.className = 'book-card';
      
      // Header 容器 - 包含封面和标题
      const header = document.createElement('div');
      header.className = 'book-header';
      
      // 1. 封面图片（顶部）
      const coverWrapper = document.createElement('div');
      coverWrapper.className = 'book-cover-wrapper';
      
      if (book.封面) {
        const img = document.createElement('img');
        img.src = proxyImage(book.封面);
        img.alt = book.title || '书籍封面';
        img.className = 'book-cover';
        img.loading = 'lazy';
        
        // 错误处理
        img.onerror = function() {
          console.warn('Failed to load image:', book.封面);
          this.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.className = 'book-cover-placeholder';
          placeholder.textContent = '📚';
          coverWrapper.appendChild(placeholder);
        };
        
        coverWrapper.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'book-cover-placeholder';
        placeholder.textContent = '📚';
        coverWrapper.appendChild(placeholder);
      }
      
      header.appendChild(coverWrapper);
      
      // 2. 标题（在封面下方）
      const titleSection = document.createElement('div');
      titleSection.className = 'book-title-section';
      
      const title = document.createElement('h3');
      title.className = 'book-title';
      const titleLink = document.createElement('a');
      titleLink.href = book.file;
      titleLink.textContent = book.title || '未命名';
      titleLink.title = book.title || '未命名';
      title.appendChild(titleLink);
      titleSection.appendChild(title);
      
      header.appendChild(titleSection);
      card.appendChild(header);
      
      // 3. 评分（在标题下方，header外）
      if (book.score) {
        const rating = document.createElement('div');
        rating.className = 'book-rating';
        
        const stars = document.createElement('span');
        stars.className = 'stars';
        stars.textContent = book.scoreStar || '⭐'.repeat(Math.floor(parseFloat(book.score) / 2));
        
        const score = document.createElement('span');
        score.className = 'score';
        score.textContent = book.score;
        
        rating.appendChild(stars);
        rating.appendChild(score);
        card.appendChild(rating);
      }
      
      // 4. 我的评分
      if (book.myRate) {
        const myRating = document.createElement('div');
        myRating.className = 'my-rating';
        myRating.textContent = '我的评分: ' + book.myRate + '/5';
        card.appendChild(myRating);
      }
      
      // 5. 详细信息
      const info = document.createElement('div');
      info.className = 'book-info';
      
      const infoItems = [
        { label: '原名', value: book.originalTitle },
        { label: '作者', value: book.author },
        { label: '出版', value: book.publishDate },
        { label: '开始', value: book.添加时间 },
        { label: '完成', value: book.结束阅读 },
        { label: '用时', value: days > 0 ? days + ' 天' : null },
        { label: '进度', value: book.totalPage ? (book.currentPage || 0) + '/' + book.totalPage + ' 页' : null }
      ];
      
      infoItems.forEach(item => {
        if (item.value) {
          const row = document.createElement('div');
          row.className = 'info-row';
          
          const label = document.createElement('span');
          label.className = 'label';
          label.textContent = item.label + ':';
          
          const value = document.createElement('span');
          value.textContent = item.value;
          
          row.appendChild(label);
          row.appendChild(value);
          info.appendChild(row);
        }
      });
      
      if (info.children.length > 0) {
        card.appendChild(info);
      }
      
      // 6. 进度条
      if (book.totalPage && book.阅读状态 && !book.阅读状态.includes('已读完')) {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'book-progress';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.width = progress + '%';
        progressContainer.appendChild(progressBar);
        
        card.appendChild(progressContainer);
        
        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.textContent = progress + '%';
        card.appendChild(progressText);
      }
      
      // 7. 状态标签
      const status = document.createElement('span');
      const statusClass = String(book.阅读状态 || 'Unknown')
        .split(',')[0]
        .replace(/\s/g, '-');
      status.className = 'book-status status-' + statusClass;
      status.textContent = book.阅读状态 || 'Unknown';
      card.appendChild(status);
      
      return card;
    }
  
    // ==================== 主加载函数 ====================
    
    async function loadAndRenderBooks() {
      console.log('🔍 Looking for book query containers...');
      const containers = document.querySelectorAll('[data-book-query]');
      console.log('Found ' + containers.length + ' containers');
      
      if (containers.length === 0) {
        console.warn('⚠️ No [data-book-query] elements found');
        return;
      }
      
      for (const container of containers) {
        const status = container.getAttribute('data-status');
        const sortBy = container.getAttribute('data-sort') || '添加时间';
        const order = container.getAttribute('data-order') || 'DESC';
        const limit = parseInt(container.getAttribute('data-limit')) || null;
        
        console.log('Loading books with status: ' + (status || 'all'));
        container.innerHTML = '<div class="book-query-loading">📚 加载书籍中...</div>';
        
        try {
          console.log('📡 Fetching /static/book-index.json...');
          const response = await fetch('/static/book-index.json');
          console.log('Response status: ' + response.status);
          
          if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
          }
          
          let books = await response.json();
          console.log('✅ Loaded ' + books.length + ' books from index');
          
        // 🚫 过滤掉内容包含 #电影 的书籍（根据 title、author、status、file 路径等判断）
        books = books.filter(book => {
            return !(
            (book.title && book.title.includes('电影')) ||
            (book.author && book.author.includes('电影')) ||
            (book.file && book.file.includes('电影')) ||
            (book.阅读状态 && book.阅读状态.includes('电影'))
            );
        });
        console.log('🧹 Filtered out #电影 books, remaining:', books.length);
        


          // 过滤状态
          if (status) {
            books = books.filter(book => {
              const bookStatuses = String(book.阅读状态 || '')
                .split(',')
                .map(s => s.trim());
              return bookStatuses.includes(status);
            });
            console.log('Filtered to ' + books.length + ' books with status "' + status + '"');
          }
          
          // 排序
          books.sort((a, b) => {
            const aVal = a[sortBy] || '';
            const bVal = b[sortBy] || '';
            const comparison = aVal > bVal ? 1 : -1;
            return order === 'DESC' ? -comparison : comparison;
          });
          
          // 限制数量
          if (limit && limit > 0) {
            books = books.slice(0, limit);
            console.log('Limited to ' + books.length + ' books');
          }
          
          // 渲染
          if (books.length === 0) {
            container.innerHTML = '<div class="book-query-error">😔 没有找到状态为"' + (status || '任何') + '"的书籍</div>';
          } else {
            const grid = document.createElement('div');
            grid.className = 'book-grid';
            
            books.forEach(book => {
              grid.appendChild(renderBookCard(book));
            });
            
            container.innerHTML = '';
            container.appendChild(grid);
            console.log('✅ Rendered ' + books.length + ' book cards');
          }
        } catch (error) {
          console.error('❌ Error loading books:', error);
          container.innerHTML = '<div class="book-query-error">❌ 加载失败: ' + error.message + '<br><small>请检查浏览器控制台</small><br><small>确保已运行: npm run generate-books</small></div>';
        }
      }
    }
  
    // ==================== 初始化 ====================
    
    function init() {
      console.log('Document ready state:', document.readyState);
      
      // DOM 加载完成后执行
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          console.log('DOMContentLoaded fired');
          loadAndRenderBooks();
        });
      } else {
        console.log('DOM already loaded, running immediately');
        loadAndRenderBooks();
      }
      
      // 监听 Quartz 页面导航事件
      document.addEventListener('nav', function() {
        console.log('Navigation event detected');
        setTimeout(loadAndRenderBooks, 100);
      });
    }
  
    // 启动
    init();
  })();