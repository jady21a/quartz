(function() {
  'use strict';

  var videoIndexPromise = null;

  function normalizePathname(pathname) {
    if (!pathname) return '';
    return pathname.replace(/\.html$/, '').replace(/\/index$/, '');
  }

  function loadVideoIndex() {
    if (!videoIndexPromise) {
      videoIndexPromise = fetch('/video-index.json')
        .then(function(response) {
          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }
          return response.json();
        })
        .catch(function() {
          return [];
        });
    }
    return videoIndexPromise;
  }

  function applyMetadataToContainer(container, video) {
    if (!video) return;

    if (!container.getAttribute('data-youtube') && video.videoid) {
      container.setAttribute('data-youtube', video.videoid);
    }
    if (!container.getAttribute('data-bilibili') && video.bilibiliid) {
      container.setAttribute('data-bilibili', video.bilibiliid);
    }
    if (!container.getAttribute('data-default-source') && video.defaultSource) {
      container.setAttribute('data-default-source', video.defaultSource);
    }
    if (!container.getAttribute('data-title') && video.title) {
      container.setAttribute('data-title', video.title);
    }
  }

  async function enrichContainerFromIndex(container) {
    var currentPath = normalizePathname(window.location.pathname);
    if (!currentPath) return;

    var videos = await loadVideoIndex();
    var currentVideo = videos.find(function(video) {
      return normalizePathname(video.file) === currentPath;
    });

    applyMetadataToContainer(container, currentVideo);
  }

  function createSourceButton(label, isActive, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'video-source-button' + (isActive ? ' is-active' : '');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function createYoutubePlayer(videoId, playLabel) {
    var player = document.createElement('lite-youtube');
    player.setAttribute('videoid', videoId);
    player.setAttribute('playlabel', playLabel || '播放视频');
    return player;
  }

  function createBilibiliPlayer(bvid, title) {
    var iframe = document.createElement('iframe');
    iframe.className = 'video-source-iframe';
    iframe.src = 'https://player.bilibili.com/player.html?bvid=' + encodeURIComponent(bvid) + '&page=1&autoplay=0';
    iframe.title = title || 'Bilibili 视频播放器';
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    return iframe;
  }

  function getSources(container) {
    var youtubeId = (container.getAttribute('data-youtube') || '').trim();
    var bilibiliId = (container.getAttribute('data-bilibili') || '').trim();
    var sources = [];

    if (youtubeId) {
      sources.push({ key: 'youtube', label: 'YouTube', id: youtubeId });
    }
    if (bilibiliId) {
      sources.push({ key: 'bilibili', label: 'Bilibili', id: bilibiliId });
    }

    return sources;
  }

  async function enhancePlayer(container) {
    if (container.getAttribute('data-player-ready') === 'true') return;

    await enrichContainerFromIndex(container);

    var sources = getSources(container);
    if (sources.length === 0) return;

    var existingLite = container.querySelector('lite-youtube');
    var playLabel = existingLite ? existingLite.getAttribute('playlabel') : '';
    var title = playLabel || container.getAttribute('data-title') || '';
    var defaultSource = (container.getAttribute('data-default-source') || '').trim();
    var activeKey = defaultSource || sources[0].key;

    container.innerHTML = '';
    container.classList.add('video-player-enhanced');

    var tabs = null;
    if (sources.length > 1) {
      var sourceBar = document.createElement('div');
      sourceBar.className = 'video-source-bar';

      var sourceLabel = document.createElement('span');
      sourceLabel.className = 'video-source-label';
      sourceLabel.textContent = '播放源:';
      sourceBar.appendChild(sourceLabel);

      tabs = document.createElement('div');
      tabs.className = 'video-source-tabs';
      sourceBar.appendChild(tabs);

      container.appendChild(sourceBar);
    }

    var stage = document.createElement('div');
    stage.className = 'video-source-stage';
    container.appendChild(stage);

    function renderActiveSource(sourceKey) {
      activeKey = sourceKey;
      stage.innerHTML = '';

      var activeSource = sources.find(function(source) {
        return source.key === sourceKey;
      }) || sources[0];

      if (activeSource.key === 'youtube') {
        stage.appendChild(createYoutubePlayer(activeSource.id, title));
      } else {
        stage.appendChild(createBilibiliPlayer(activeSource.id, title));
      }

      if (tabs) {
        tabs.innerHTML = '';
        sources.forEach(function(source) {
          tabs.appendChild(createSourceButton(source.label, source.key === activeKey, function() {
            if (source.key !== activeKey) {
              renderActiveSource(source.key);
            }
          }));
        });
      }
    }

    renderActiveSource(activeKey);
    container.setAttribute('data-player-ready', 'true');
  }

  // 按需注入 lite-youtube CDN（用 createElement 才会执行，SPA 导航下也有效），
  // 这样普通页面不会加载它，只有出现播放器时才拉取。
  function ensureLiteYoutube() {
    if (window.__liteYoutubeLoaded) return;
    window.__liteYoutubeLoaded = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/lite-youtube-embed@0.3.2/src/lite-yt-embed.css';
    document.head.appendChild(link);
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/lite-youtube-embed@0.3.2/src/lite-yt-embed.js';
    script.defer = true;
    document.head.appendChild(script);
  }

  async function initVideoPlayers() {
    var containers = document.querySelectorAll('.video-player-container');
    if (containers.length === 0) return;
    ensureLiteYoutube();
    for (var i = 0; i < containers.length; i++) {
      await enhancePlayer(containers[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoPlayers);
  } else {
    initVideoPlayers();
  }

  document.addEventListener('nav', function() {
    setTimeout(initVideoPlayers, 100);
  });
})();
