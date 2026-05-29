// quartz/static/video-query.js
(function() {
  'use strict';


  // ==================== 工具函数 ====================

  function fixFilePath(filePath) {
    if (!filePath) return '#';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    let path = filePath.replace(/^\.?\//, '');
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    if (!path.match(/\.\w+$/) || path.endsWith('.md')) {
      path = path.replace(/\.md$/, '') + '.html';
    }
    return path;
  }

  function getPreferredThumbnail(video) {
    if (video.thumbnail) return video.thumbnail;
    if (video.videoid) return `https://i.ytimg.com/vi/${video.videoid}/hqdefault.jpg`;
    return '';
  }

  // ==================== 渲染函数 ====================

  function renderVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';

    // 1. 封面缩略图（可点击跳转到视频详情页播放）
    var coverSrc = getPreferredThumbnail(video);
    if (coverSrc) {
      const coverLink = document.createElement('a');
      coverLink.href = fixFilePath(video.file);
      coverLink.className = 'video-cover-link';
      coverLink.title = video.title || '播放视频';

      const img = document.createElement('img');
      img.src = coverSrc;
      img.alt = video.title || '视频封面';
      img.className = 'video-cover-img';
      img.loading = 'lazy';
      // maxresdefault.jpg 并非所有视频都有，加载失败时回退到 hqdefault.jpg
      img.onerror = function() {
        if (video.videoid && img.src.indexOf('maxresdefault.jpg') !== -1) {
          img.src = `https://i.ytimg.com/vi/${video.videoid}/hqdefault.jpg`;
          img.onerror = null; // 防止无限回退
        }
      };

      coverLink.appendChild(img);
      card.appendChild(coverLink);
    }

    // 2. 标题（也可点击跳转）
    const title = document.createElement('h3');
    title.className = 'video-card-title';
    const link = document.createElement('a');
    link.href = fixFilePath(video.file);
    link.textContent = video.title || '未命名';
    link.title = video.title || '未命名';
    title.appendChild(link);
    card.appendChild(title);

    // 3. 日期
    if (video.date) {
      const dateEl = document.createElement('div');
      dateEl.className = 'video-card-date';
      dateEl.textContent = video.date;
      card.appendChild(dateEl);
    }

    // 4. 描述
    if (video.description) {
      const desc = document.createElement('div');
      desc.className = 'video-card-desc';
      desc.textContent = video.description;
      card.appendChild(desc);
    }

    // 5. 分类标签
    if (video.category) {
      const cat = document.createElement('span');
      cat.className = 'video-card-category';
      cat.textContent = video.category;
      card.appendChild(cat);
    }

    return card;
  }

  // ==================== 过滤与排序 ====================

  function filterAndSort(videos, options) {
    var result = videos.slice();

    if (options.category) {
      result = result.filter(function(v) {
        return v.category === options.category;
      });
    }

    if (options.search) {
      var q = options.search.toLowerCase();
      result = result.filter(function(v) {
        return (v.title || '').toLowerCase().indexOf(q) !== -1 ||
               (v.description || '').toLowerCase().indexOf(q) !== -1 ||
               (v.category || '').toLowerCase().indexOf(q) !== -1;
      });
    }

    var sortBy = options.sortBy || 'date';
    var order = options.order || 'DESC';
    result.sort(function(a, b) {
      var aVal = a[sortBy] || '';
      var bVal = b[sortBy] || '';
      if (aVal > bVal) return order === 'DESC' ? -1 : 1;
      if (aVal < bVal) return order === 'DESC' ? 1 : -1;
      return 0;
    });

    if (options.limit && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  // ==================== 主加载函数 ====================

  async function loadAndRenderVideos() {
    var containers = document.querySelectorAll('[data-video-query]');
    if (containers.length === 0) return;

    for (var i = 0; i < containers.length; i++) {
      var container = containers[i];
      var category = container.getAttribute('data-category');
      var sortBy = container.getAttribute('data-sort') || 'date';
      var order = container.getAttribute('data-order') || 'DESC';
      var limit = parseInt(container.getAttribute('data-limit')) || null;
      var search = container.getAttribute('data-search');

      container.innerHTML = '<div class="video-query-loading">🎬 加载视频中...</div>';

      try {
        var response = await fetch('/video-index.json');
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }

        var allVideos = await response.json();

        var videos = filterAndSort(allVideos, {
          category: category,
          sortBy: sortBy,
          order: order,
          limit: limit,
          search: search,
        });

        if (videos.length === 0) {
          container.innerHTML = '<div class="video-query-empty">暂无视频</div>';
          continue;
        }

        var grid = document.createElement('div');
        grid.className = 'video-grid';

        videos.forEach(function(video) {
          grid.appendChild(renderVideoCard(video));
        });

        container.innerHTML = '';
        container.appendChild(grid);

      } catch (error) {
        console.error('❌ Error loading videos:', error);
        container.innerHTML = '<div class="video-query-error">❌ 加载失败: ' + error.message + '<br><small>请确保已运行: npm run generate-videos</small></div>';
      }
    }
  }

  // ==================== 初始化 ====================

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadAndRenderVideos);
    } else {
      loadAndRenderVideos();
    }

    document.addEventListener('nav', function() {
      setTimeout(loadAndRenderVideos, 100);
    });
  }

  init();
})();
