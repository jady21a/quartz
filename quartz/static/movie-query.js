// quartz/static/movie-query.js
(function() {
    'use strict';
    
    console.log('🎬 Movie query script loaded');
  
    // ==================== 工具函数 ====================
    
    // 图片代理函数 - 处理豆瓣防盗链
    function proxyImage(imageUrl) {
      if (!imageUrl) return '';
      
      // 检查是否是豆瓣图片
      if (imageUrl.includes('douban.com') || imageUrl.includes('doubanio.com')) {
        const urlWithoutProtocol = imageUrl.replace(/^https?:\/\//, '');
        return `https://images.weserv.nl/?url=${urlWithoutProtocol}&w=200&h=280&fit=cover&output=webp&q=85`;
      }
      
      return imageUrl;
    }
  
    // 计算观看天数
    function calculateDays(start, end, addTime) {
      let startDate;
      if (start) {
        startDate = new Date(start);
      } else if (addTime) {
        startDate = new Date(addTime);
      } else {
        return 0;
      }
      
      const endDate = end ? new Date(end) : new Date();
      const diff = endDate.getTime() - startDate.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      
      return days > 0 ? days : 0;
    }
  
    // ==================== 渲染函数 ====================
    
    // 渲染单个影片卡片
    function renderMovieCard(movie) {
      const card = document.createElement('div');
      card.className = 'movie-card';
      
      // Header 容器 - 包含海报和标题
      const header = document.createElement('div');
      header.className = 'movie-header';
      
      // 1. 海报图片（顶部）
      const posterWrapper = document.createElement('div');
      posterWrapper.className = 'movie-poster-wrapper';
      
      if (movie.封面) {
        const img = document.createElement('img');
        img.src = proxyImage(movie.封面);
        img.alt = movie.title || '影片海报';
        img.className = 'movie-poster';
        img.loading = 'lazy';
        
        img.onerror = function() {
          console.warn('Failed to load image:', movie.封面);
          this.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.className = 'movie-poster-placeholder';
          placeholder.textContent = '🎬';
          posterWrapper.appendChild(placeholder);
        };
        
        posterWrapper.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'movie-poster-placeholder';
        placeholder.textContent = '🎬';
        posterWrapper.appendChild(placeholder);
      }
      
      header.appendChild(posterWrapper);
      
      // 2. 标题（在海报下方）
      const titleSection = document.createElement('div');
      titleSection.className = 'movie-title-section';
      
      const title = document.createElement('h3');
      title.className = 'movie-title';
      const titleLink = document.createElement('a');
      titleLink.href = movie.file;
      titleLink.textContent = movie.title || '未命名';
      titleLink.title = movie.title || '未命名';
      title.appendChild(titleLink);
      titleSection.appendChild(title);
      
      header.appendChild(titleSection);
      card.appendChild(header);
      
      // 3. 评分（在标题下方，header外）
      if (movie.score) {
        const rating = document.createElement('div');
        rating.className = 'movie-rating';
        
        const stars = document.createElement('span');
        stars.className = 'stars';
        stars.textContent = movie.scoreStar || '⭐'.repeat(Math.floor(parseFloat(movie.score) / 2));
        
        const score = document.createElement('span');
        score.className = 'score';
        score.textContent = movie.score;
        
        rating.appendChild(stars);
        rating.appendChild(score);
        card.appendChild(rating);
      }
      
      // 4. 我的评分
      if (movie.myRate) {
        const myRating = document.createElement('div');
        myRating.className = 'my-rating';
        myRating.textContent = '我的评分: ' + movie.myRate + '/5';
        card.appendChild(myRating);
      }
      
      // 5. 详细信息
      const info = document.createElement('div');
      info.className = 'movie-info';
      
      // 计算用时
      const days = calculateDays(movie.开始时间, movie.结束时间 || movie.结束阅读, movie.添加时间);
      
      const infoItems = [
        { label: '原名', value: movie.originalTitle },
        { label: '地区', value: movie.country },
        { label: '导演', value: movie.director },
        { label: '类型', value: movie.genre },
        { label: '上映时间', value: movie.releaseDate || movie.datePublished },
        { label: '添加时间', value: movie.添加时间 },
        // { label: '用时', value: days > 0 ? days + ' 天' : null },
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
      
      // 6. 底部容器（状态）
      const footer = document.createElement('div');
      footer.className = 'movie-footer';
      
      // 状态标签 - 兼容多种字段名
      const statusText = String(
        movie.观看状态 || 
        movie.状态 || 
        movie.阅读状态 || 
        movie.status || 
        ''
      ).trim();
      
      const status = document.createElement('span');
      const statusClass = statusText
        .split(',')[0]
        .replace(/\s/g, '-') || 'Unknown';
      status.className = 'movie-status status-' + statusClass;
      status.textContent = statusText || 'Unknown';
      footer.appendChild(status);
      
      card.appendChild(footer);
      
      return card;
    }
  
    // ==================== 主加载函数 ====================
    
    async function loadAndRenderMovies() {
      console.log('🔍 Looking for movie query containers...');
      const containers = document.querySelectorAll('[data-movie-query]');
      console.log('Found ' + containers.length + ' containers');
      
      if (containers.length === 0) {
        console.warn('⚠️ No [data-movie-query] elements found');
        return;
      }
      
      for (const container of containers) {
        const status = container.getAttribute('data-status');
        const sortBy = container.getAttribute('data-sort') || '添加时间';
        const order = container.getAttribute('data-order') || 'DESC';
        const limit = parseInt(container.getAttribute('data-limit')) || null;
        const type = container.getAttribute('data-type'); // movies 或 teleplay
        
        console.log('Loading movies with status: ' + (status || 'all'));
        container.innerHTML = '<div class="movie-query-loading">🎬 加载影片中...</div>';
        
        try {
          console.log('📡 Fetching /static/movie-index.json...');
          const response = await fetch('/static/movie-index.json');
          console.log('Response status: ' + response.status);
          
          if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
          }
          
          let allItems = await response.json();
          console.log('✅ Loaded ' + allItems.length + ' items from index');
          
          // 第一步：过滤出影视内容（有 movies 或 teleplay 标签的）
          let movies = allItems.filter(item => {
            const tags = item.tags || [];
            const hasMovieTag = tags.some(tag => 
              tag && (
                tag.toLowerCase() === 'movies' || 
                tag.toLowerCase() === 'movie' ||
                tag.toLowerCase() === 'teleplay' ||
                tag.toLowerCase() === 'tv' ||
                tag.toLowerCase() === '电影' ||
                tag.toLowerCase() === '电视剧'
              )
            );
            return hasMovieTag;
          });
          
          console.log('After filtering movies/teleplay: ' + movies.length + ' items');
          
          // 第二步：根据 data-type 进一步过滤
          if (type) {
            movies = movies.filter(movie => {
              const tags = movie.tags || [];
              if (type === 'movies') {
                return tags.some(tag => 
                  tag && (tag.toLowerCase() === 'movies' || 
                          tag.toLowerCase() === 'movie' ||
                          tag.toLowerCase() === '电影')
                );
              } else if (type === 'teleplay') {
                return tags.some(tag => 
                  tag && (tag.toLowerCase() === 'teleplay' || 
                          tag.toLowerCase() === 'tv' ||
                          tag.toLowerCase() === '电视剧')
                );
              }
              return true;
            });
            console.log('Filtered to ' + movies.length + ' items by type: ' + type);
          }
          
          // 第三步：过滤状态
          if (status) {
            movies = movies.filter(movie => {
              // 兼容多种状态字段名
              const movieStatus = String(
                movie.观看状态 || 
                movie.状态 || 
                movie.阅读状态 || 
                movie.status || 
                ''
              );
              const movieStatuses = movieStatus
                .split(',')
                .map(s => s.trim());
              return movieStatuses.includes(status);
            });
            console.log('Filtered to ' + movies.length + ' movies with status "' + status + '"');
          }
          
          // 排序
          movies.sort((a, b) => {
            const aVal = a[sortBy] || '';
            const bVal = b[sortBy] || '';
            const comparison = aVal > bVal ? 1 : -1;
            return order === 'DESC' ? -comparison : comparison;
          });
          
          // 限制数量
          if (limit && limit > 0) {
            movies = movies.slice(0, limit);
            console.log('Limited to ' + movies.length + ' movies');
          }
          
          // 渲染
          if (movies.length === 0) {
            const msg = status 
              ? '😔 没有找到状态为"' + status + '"的影片'
              : '😔 没有找到符合条件的影片<br><small>请确保笔记的 tags 包含 movies 或 teleplay</small>';
            container.innerHTML = '<div class="movie-query-error">' + msg + '</div>';
          } else {
            const grid = document.createElement('div');
            grid.className = 'movie-grid';
            
            movies.forEach(movie => {
              grid.appendChild(renderMovieCard(movie));
            });
            
            container.innerHTML = '';
            container.appendChild(grid);
            console.log('✅ Rendered ' + movies.length + ' movie cards');
          }
        } catch (error) {
          console.error('❌ Error loading movies:', error);
          container.innerHTML = '<div class="movie-query-error">❌ 加载失败: ' + error.message + '<br><small>请检查浏览器控制台</small></div>';
        }
      }
    }
  
    // ==================== 初始化 ====================
    
    function init() {
      console.log('Document ready state:', document.readyState);
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          console.log('DOMContentLoaded fired');
          loadAndRenderMovies();
        });
      } else {
        console.log('DOM already loaded, running immediately');
        loadAndRenderMovies();
      }
      
      // 监听 Quartz 页面导航事件
      document.addEventListener('nav', function() {
        console.log('Navigation event detected');
        setTimeout(loadAndRenderMovies, 100);
      });
    }
  
    // 启动
    init();
  })();