(function() {
  'use strict';

  var videoIndexPromise = null;

  function normalizePathname(pathname) {
    if (!pathname) return '';
    var decoded = pathname;
    try {
      decoded = decodeURIComponent(pathname);
    } catch (e) {
      decoded = pathname;
    }
    return decoded.replace(/\.html$/, '').replace(/\/index$/, '');
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

  function createSourceButton(label, isActive, available, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className =
      'video-source-button' +
      (isActive ? ' is-active' : '') +
      (available ? '' : ' is-disabled');
    button.textContent = label;
    if (available) {
      button.addEventListener('click', onClick);
    } else {
      button.disabled = true;
      button.title = '暂无视频源';
      button.setAttribute('aria-disabled', 'true');
    }
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

  // 模板没填真实 ID 时残留的占位符，视为「没有视频」
  var PLACEHOLDER_SOURCE_IDS = [
    'video_id',
    'youtube_id',
    'youtubeid',
    'bilibili_id',
    'bilibiliid',
    'bvid',
    'bv_id',
  ];

  function isValidSourceId(id) {
    if (!id) return false;
    return PLACEHOLDER_SOURCE_IDS.indexOf(id.toLowerCase()) === -1;
  }

  // 默认播放源自动分流(对齐语言切换的优先级设计,见 LanguageSwitch.tsx):
  // 手动选过的源(videoSourcePref,点击切换时写入)最优先;其次跟随站点语言偏好
  // langPref(选英文的人大概率翻墙无碍 → YouTube);都没有则按浏览器语言,
  // 中文浏览器默认 Bilibili,其余默认 YouTube。返回空串表示不干预。
  function detectPreferredSource() {
    try {
      var pref = localStorage.getItem('videoSourcePref');
      if (pref === 'bilibili' || pref === 'youtube') return pref;
      var langPref = localStorage.getItem('langPref');
      if (langPref === 'en') return 'youtube';
      if (langPref === 'zh') return 'bilibili';
      var langs = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || ''];
      var isZh = langs.some(function(l) {
        return l.toLowerCase().lastIndexOf('zh', 0) === 0;
      });
      return isZh ? 'bilibili' : 'youtube';
    } catch (e) {
      return '';
    }
  }

  function rememberSourcePref(key) {
    try {
      localStorage.setItem('videoSourcePref', key);
    } catch (e) {}
  }

  // 始终返回 YouTube 和 Bilibili 两个源；没有有效 ID 的标记为不可用
  function getSources(container) {
    var youtubeId = (container.getAttribute('data-youtube') || '').trim();
    var bilibiliId = (container.getAttribute('data-bilibili') || '').trim();

    return [
      { key: 'bilibili', label: 'Bilibili', id: bilibiliId, available: isValidSourceId(bilibiliId) },
      { key: 'youtube', label: 'YouTube', id: youtubeId, available: isValidSourceId(youtubeId) },
    ];
  }

  async function enhancePlayer(container) {
    if (container.getAttribute('data-player-ready') === 'true') return;

    await enrichContainerFromIndex(container);

    var sources = getSources(container);
    var availableSources = sources.filter(function(source) {
      return source.available;
    });
    if (availableSources.length === 0) return;

    var existingLite = container.querySelector('lite-youtube');
    var playLabel = existingLite ? existingLite.getAttribute('playlabel') : '';
    var title = playLabel || container.getAttribute('data-title') || '';
    var defaultSource = (container.getAttribute('data-default-source') || '').trim();
    var findAvailable = function(key) {
      return availableSources.find(function(source) {
        return source.key === key;
      });
    };
    // 访客侧信号(手动偏好/语言)优先于页面 frontmatter 里写死的 defaultSource
    var chosen = findAvailable(detectPreferredSource()) || findAvailable(defaultSource) || availableSources[0];
    var activeKey = chosen.key;

    container.innerHTML = '';
    container.classList.add('video-player-enhanced');

    // 播放源切换条始终显示（两个按钮都在；无视频的源不可点）
    var sourceBar = document.createElement('div');
    sourceBar.className = 'video-source-bar';

    var sourceLabel = document.createElement('span');
    sourceLabel.className = 'video-source-label';
    sourceLabel.textContent = '播放源:';
    sourceBar.appendChild(sourceLabel);

    var tabs = document.createElement('div');
    tabs.className = 'video-source-tabs';
    sourceBar.appendChild(tabs);

    container.appendChild(sourceBar);

    var stage = document.createElement('div');
    stage.className = 'video-source-stage';
    container.appendChild(stage);

    function renderActiveSource(sourceKey) {
      activeKey = sourceKey;
      stage.innerHTML = '';

      var activeSource = sources.find(function(source) {
        return source.key === sourceKey && source.available;
      }) || availableSources[0];

      if (activeSource.key === 'youtube') {
        stage.appendChild(createYoutubePlayer(activeSource.id, title));
      } else {
        stage.appendChild(createBilibiliPlayer(activeSource.id, title));
      }

      tabs.innerHTML = '';
      sources.forEach(function(source) {
        tabs.appendChild(
          createSourceButton(source.label, source.key === activeKey, source.available, function() {
            rememberSourcePref(source.key);
            if (source.key !== activeKey) {
              renderActiveSource(source.key);
            }
          }),
        );
      });
    }

    renderActiveSource(activeKey);
    container.setAttribute('data-player-ready', 'true');
  }

  // 运行时注入 lite-youtube 的「脚本」(用 createElement 才会执行，SPA 导航下也有效)。
  // 只注入 JS、不注入 CSS：自定义元素注册表在 SPA 导航间常驻,首访 define 之后一直有效,
  // 所以脚本被 head 补丁清掉也没关系。但 CSS 不同 —— 它必须一直在 head 里才生效,而 SPA
  // 导航会清掉运行时注入的 <link>(spa.inline.ts 的 head 补丁去掉非 spa-preserve 元素),
  // __liteYoutubeLoaded 又拦住重注入 → 详情页互跳后样式没了、播放器塌成 20px。故 CSS 改由
  // Head.tsx 在播放器页 SSR 成常驻 <link rel=stylesheet>(每次导航 head 补丁会重新补上)。
  // 自托管而非走 jsDelivr：cdn.jsdelivr.net 国内节点 2021 年已下线,且多数代理分流规则把
  // jsdelivr 归「直连」放行 → 代理开着也连不上 → 库加载不出。改引本站根路径 /lite-yt-embed.js
  // (源文件由 quartz/static 拷到站点根),对国内访客也稳。
  function ensureLiteYoutube() {
    if (window.__liteYoutubeLoaded) return;
    window.__liteYoutubeLoaded = true;
    var script = document.createElement('script');
    script.src = '/lite-yt-embed.js';
    script.defer = true;
    // 首访冷缓存时让脚本抢在其它资源前面加载,配合 Head 里的 preload 尽快 define
    // 出 <lite-youtube>,避免 YouTube 源首访的空白窗口。
    script.fetchPriority = 'high';
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
