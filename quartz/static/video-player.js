;(function () {
  "use strict"

  var videoIndexPromise = null

  function normalizePathname(pathname) {
    if (!pathname) return ""
    var decoded = pathname
    try {
      decoded = decodeURIComponent(pathname)
    } catch (e) {
      decoded = pathname
    }
    return decoded.replace(/\.html$/, "").replace(/\/index$/, "")
  }

  // video-index.json 只按中文原文的路径建索引(/videos/...),英文镜像页的 URL 多一层 /en
  // 前缀 → 直接比对匹配不上 → 容器拿不到 data-youtube/data-bilibili → 英文页「没有视频」。
  // 查索引前先把 /en 前缀剥掉,中英两边共用同一条索引记录。实现见 lang-util.js。
  function stripLangPrefix(pathname) {
    return window.QuartzLang.stripLangPrefix(pathname)
  }

  function loadVideoIndex() {
    if (!videoIndexPromise) {
      videoIndexPromise = fetch("/video-index.json")
        .then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status)
          }
          return response.json()
        })
        .catch(function () {
          return []
        })
    }
    return videoIndexPromise
  }

  function applyMetadataToContainer(container, video) {
    if (!video) return

    if (!container.getAttribute("data-youtube") && video.videoid) {
      container.setAttribute("data-youtube", video.videoid)
    }
    if (!container.getAttribute("data-bilibili") && video.bilibiliid) {
      container.setAttribute("data-bilibili", video.bilibiliid)
    }
    if (!container.getAttribute("data-default-source") && video.defaultSource) {
      container.setAttribute("data-default-source", video.defaultSource)
    }
    if (!container.getAttribute("data-title") && video.title) {
      container.setAttribute("data-title", video.title)
    }
  }

  async function enrichContainerFromIndex(container) {
    var currentPath = stripLangPrefix(normalizePathname(window.location.pathname))
    if (!currentPath) return

    var videos = await loadVideoIndex()
    var currentVideo = videos.find(function (video) {
      return stripLangPrefix(normalizePathname(video.file)) === currentPath
    })

    applyMetadataToContainer(container, currentVideo)
  }

  function createSourceButton(label, isActive, available, onClick) {
    var button = document.createElement("button")
    button.type = "button"
    button.className =
      "video-source-button" + (isActive ? " is-active" : "") + (available ? "" : " is-disabled")
    button.textContent = label
    if (available) {
      button.addEventListener("click", onClick)
    } else {
      button.disabled = true
      button.title = "暂无视频源"
      button.setAttribute("aria-disabled", "true")
    }
    return button
  }

  function createYoutubePlayer(videoId, playLabel) {
    var player = document.createElement("lite-youtube")
    player.setAttribute("videoid", videoId)
    player.setAttribute("playlabel", playLabel || "播放视频")
    return player
  }

  function createBilibiliPlayer(bvid, title) {
    var iframe = document.createElement("iframe")
    iframe.className = "video-source-iframe"
    iframe.src =
      "https://player.bilibili.com/player.html?bvid=" +
      encodeURIComponent(bvid) +
      "&page=1&autoplay=0"
    iframe.title = title || "Bilibili 视频播放器"
    iframe.loading = "lazy"
    iframe.allowFullscreen = true
    iframe.referrerPolicy = "strict-origin-when-cross-origin"
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    return iframe
  }

  // 模板没填真实 ID 时残留的占位符，视为「没有视频」
  var PLACEHOLDER_SOURCE_IDS = [
    "video_id",
    "youtube_id",
    "youtubeid",
    "bilibili_id",
    "bilibiliid",
    "bvid",
    "bv_id",
  ]

  function isValidSourceId(id) {
    if (!id) return false
    return PLACEHOLDER_SOURCE_IDS.indexOf(id.toLowerCase()) === -1
  }

  // 默认播放源自动分流。真正要回答的问题是「这个访客当前的网络能不能顺畅看 YouTube」,
  // 所以按网络信号而非语言判断,优先级:
  //   1. 手动选过的源(videoSourcePref,点击切换时写入,localStorage 持久化)
  //   2. IP 归属地:Cloudflare 自带的同源端点 /cdn-cgi/trace 返回 loc 国家码,
  //      非 CN(含开着全局代理的国内访客)→ YouTube
  //   3. loc=CN 时实测 i.ytimg.com 缩略图连通性,兜住「博客直连、YouTube 走代理」
  //      的分流规则用户:1.5s 内加载成功 → YouTube,否则 → Bilibili
  //   4. geo 拿不到(端点异常/超时)→ 按站点语言偏好 langPref / 浏览器语言兜底
  // 自动判定结果缓存在 sessionStorage:代理开关是会话级状态,别用 localStorage 固化。
  var AUTO_SOURCE_KEY = "videoSourceAuto"

  function getManualSourcePref() {
    try {
      var pref = localStorage.getItem("videoSourcePref")
      if (pref === "bilibili" || pref === "youtube") return pref
    } catch (e) {}
    return ""
  }

  function languageFallbackSource() {
    try {
      var langPref = localStorage.getItem("langPref")
      if (langPref === "en") return "youtube"
      if (langPref === "zh") return "bilibili"
      var langs =
        navigator.languages && navigator.languages.length
          ? navigator.languages
          : [navigator.language || ""]
      var isZh = langs.some(function (l) {
        return l.toLowerCase().lastIndexOf("zh", 0) === 0
      })
      return isZh ? "bilibili" : "youtube"
    } catch (e) {
      return ""
    }
  }

  function withTimeout(promise, ms, fallbackValue) {
    return new Promise(function (resolve) {
      var done = false
      var timer = setTimeout(function () {
        if (!done) {
          done = true
          resolve(fallbackValue)
        }
      }, ms)
      promise.then(
        function (value) {
          if (!done) {
            done = true
            clearTimeout(timer)
            resolve(value)
          }
        },
        function () {
          if (!done) {
            done = true
            clearTimeout(timer)
            resolve(fallbackValue)
          }
        },
      )
    })
  }

  function fetchVisitorCountry() {
    var req = fetch("/cdn-cgi/trace")
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status)
        return response.text()
      })
      .then(function (text) {
        var match = text.match(/^loc=([A-Z]+)$/m)
        return match ? match[1] : ""
      })
    return withTimeout(req, 2000, "")
  }

  function probeYouTubeReachable(youtubeId) {
    var probe = new Promise(function (resolve) {
      var img = new Image()
      img.onload = function () {
        resolve(true)
      }
      img.onerror = function () {
        resolve(false)
      }
      // 带时间戳防 HTTP 缓存假阳性:上个会话代理开着缓存过这张图,这次关了仍「加载成功」
      img.src =
        "https://i.ytimg.com/vi/" + encodeURIComponent(youtubeId) + "/default.jpg?t=" + Date.now()
    })
    return withTimeout(probe, 1500, false)
  }

  async function detectPreferredSource(youtubeId) {
    var manual = getManualSourcePref()
    if (manual) return manual

    try {
      var cached = sessionStorage.getItem(AUTO_SOURCE_KEY)
      if (cached === "bilibili" || cached === "youtube") return cached
    } catch (e) {}

    var loc = await fetchVisitorCountry()
    var result
    if (loc && loc !== "CN") {
      result = "youtube"
    } else if (loc === "CN") {
      // 本页没有 YouTube 源就没法探测:直接给 Bilibili,且不缓存,留给有源的页面再测
      if (!youtubeId) return "bilibili"
      result = (await probeYouTubeReachable(youtubeId)) ? "youtube" : "bilibili"
    } else {
      // geo 失败属临时故障,语言兜底且不缓存,下次导航重试
      return languageFallbackSource()
    }

    try {
      sessionStorage.setItem(AUTO_SOURCE_KEY, result)
    } catch (e) {}
    return result
  }

  function rememberSourcePref(key) {
    try {
      localStorage.setItem("videoSourcePref", key)
    } catch (e) {}
  }

  // 始终返回 YouTube 和 Bilibili 两个源；没有有效 ID 的标记为不可用
  function getSources(container) {
    var youtubeId = (container.getAttribute("data-youtube") || "").trim()
    var bilibiliId = (container.getAttribute("data-bilibili") || "").trim()

    return [
      {
        key: "bilibili",
        label: "Bilibili",
        id: bilibiliId,
        available: isValidSourceId(bilibiliId),
      },
      { key: "youtube", label: "YouTube", id: youtubeId, available: isValidSourceId(youtubeId) },
    ]
  }

  // 播放源切换条骨架(「播放源:」标签 + 空的 tabs 容器)。按钮由调用方填,
  // 占位态和真播放器共用同一副骨架,保证两种状态的版式一致。
  function createSourceBar() {
    var bar = document.createElement("div")
    bar.className = "video-source-bar"

    var label = document.createElement("span")
    label.className = "video-source-label"
    label.textContent = "播放源:"
    bar.appendChild(label)

    var tabs = document.createElement("div")
    tabs.className = "video-source-tabs"
    bar.appendChild(tabs)

    return { bar: bar, tabs: tabs }
  }

  // 「文章写好了、视频还没发」这个中间态的样子:两个源都没 ID 时不再留一个空 div,
  // 而是渲染置灰的切换条 + 一块占位。这样本地预览草稿页(QUARTZ_KEEP_DRAFTS=1)去录屏,
  // 页面是有意为之的形态而不是半坏的空白;ID 填进来后同一页自动变成真播放器。
  // 单独打 data-player-placeholder:冒烟检查靠它把「占位」和「真播放器」分开报——
  // 占位页出现在 public/ 里仍算失败(草稿页本不该进构建),只是报错能说清是哪种坏。
  function renderPlaceholder(container, sources) {
    container.innerHTML = ""
    container.classList.add("video-player-enhanced")

    var sourceBar = createSourceBar()
    sources.forEach(function (source) {
      sourceBar.tabs.appendChild(createSourceButton(source.label, false, false, null))
    })
    container.appendChild(sourceBar.bar)

    var stage = document.createElement("div")
    stage.className = "video-source-stage video-source-stage-empty"
    var note = document.createElement("div")
    note.className = "video-source-placeholder"
    note.textContent = "视频即将发布"
    stage.appendChild(note)
    container.appendChild(stage)

    container.setAttribute("data-player-placeholder", "true")
    container.setAttribute("data-player-ready", "true")
  }

  async function enhancePlayer(container) {
    if (container.getAttribute("data-player-ready") === "true") return

    await enrichContainerFromIndex(container)

    var sources = getSources(container)
    var availableSources = sources.filter(function (source) {
      return source.available
    })
    if (availableSources.length === 0) {
      renderPlaceholder(container, sources)
      return
    }

    var existingLite = container.querySelector("lite-youtube")
    var playLabel = existingLite ? existingLite.getAttribute("playlabel") : ""
    var title = playLabel || container.getAttribute("data-title") || ""
    var defaultSource = (container.getAttribute("data-default-source") || "").trim()
    var findAvailable = function (key) {
      return availableSources.find(function (source) {
        return source.key === key
      })
    }
    // 访客侧信号(手动偏好/网络探测)优先于页面 frontmatter 里写死的 defaultSource
    var youtubeSource = findAvailable("youtube")
    var preferred = await detectPreferredSource(youtubeSource ? youtubeSource.id : "")
    var chosen = findAvailable(preferred) || findAvailable(defaultSource) || availableSources[0]
    var activeKey = chosen.key

    container.innerHTML = ""
    container.classList.add("video-player-enhanced")

    // 播放源切换条始终显示（两个按钮都在；无视频的源不可点）
    var sourceBar = createSourceBar()
    var tabs = sourceBar.tabs
    container.appendChild(sourceBar.bar)

    var stage = document.createElement("div")
    stage.className = "video-source-stage"
    container.appendChild(stage)

    function renderActiveSource(sourceKey) {
      activeKey = sourceKey
      stage.innerHTML = ""

      var activeSource =
        sources.find(function (source) {
          return source.key === sourceKey && source.available
        }) || availableSources[0]

      if (activeSource.key === "youtube") {
        stage.appendChild(createYoutubePlayer(activeSource.id, title))
      } else {
        stage.appendChild(createBilibiliPlayer(activeSource.id, title))
      }

      tabs.innerHTML = ""
      sources.forEach(function (source) {
        tabs.appendChild(
          createSourceButton(source.label, source.key === activeKey, source.available, function () {
            rememberSourcePref(source.key)
            if (source.key !== activeKey) {
              renderActiveSource(source.key)
            }
          }),
        )
      })
    }

    renderActiveSource(activeKey)
    container.setAttribute("data-player-ready", "true")
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
    if (window.__liteYoutubeLoaded) return
    window.__liteYoutubeLoaded = true
    var script = document.createElement("script")
    script.src = "/lite-yt-embed.js"
    script.defer = true
    // 首访冷缓存时让脚本抢在其它资源前面加载,配合 Head 里的 preload 尽快 define
    // 出 <lite-youtube>,避免 YouTube 源首访的空白窗口。
    script.fetchPriority = "high"
    document.head.appendChild(script)
  }

  async function initVideoPlayers() {
    var containers = document.querySelectorAll(".video-player-container")
    if (containers.length === 0) return
    ensureLiteYoutube()
    for (var i = 0; i < containers.length; i++) {
      await enhancePlayer(containers[i])
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVideoPlayers)
  } else {
    initVideoPlayers()
  }

  document.addEventListener("nav", function () {
    setTimeout(initVideoPlayers, 100)
  })
})()
