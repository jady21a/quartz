// quartz/static/gallery.js
// Unified renderer for the book / movie / video gallery queries.
// Replaces book-query.js, movie-query.js and video-query.js — the three used to
// duplicate almost all of their plumbing (fetch, filter, sort, render, init).
(function () {
  "use strict"

  // ==================== shared helpers ====================

  // 封面统一处理：本地图直接用；外链一律走 weserv 代理
  // —— 既能把 http:// 升级为 https（修复 https 站点上的 mixed-content 拦截，
  //    例如 Google Books 的 http 封面），又顺带压缩为 200×280 webp。
  function proxyImage(imageUrl) {
    if (!imageUrl) return ""
    const url = String(imageUrl).trim()
    if (!url || url === "N/A") return ""
    if (url.startsWith("/")) return url
    if (url.startsWith("./")) return url.slice(1) // ./imgs/... → /imgs/...
    if (/^https?:\/\//.test(url)) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=200&h=280&fit=cover&output=webp&q=85`
    }
    // content 相对路径（如 "2.Read/douban/..."）→ 根绝对路径，否则相对当前页解析 404
    return "/" + url
  }

  // 把笔记路径修正为可访问的 URL
  function fixFilePath(filePath) {
    if (!filePath) return "#"
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath
    let path = filePath.replace(/^\.?\//, "")
    if (!path.startsWith("/")) path = "/" + path
    if (!path.match(/\.\w+$/) || path.endsWith(".md")) {
      path = path.replace(/\.md$/, "") + ".html"
    }
    return path
  }

  function calculateProgress(current, total) {
    const curr = parseInt(current) || 0
    const tot = parseInt(total) || 0
    if (tot === 0) return 0
    return Math.min(100, Math.max(0, Math.round((curr / tot) * 100)))
  }

  function calculateDays(start, end, addTime) {
    let startDate
    if (start) startDate = new Date(start)
    else if (addTime) startDate = new Date(addTime)
    else return 0
    const endDate = end ? new Date(end) : new Date()
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)
    return days > 0 ? days : 0
  }

  function addInfoRows(info, items) {
    items.forEach(function (item) {
      if (!item.value) return
      const row = document.createElement("div")
      row.className = "info-row"
      const label = document.createElement("span")
      label.className = "label"
      label.textContent = item.label + ":"
      const value = document.createElement("span")
      value.textContent = item.value
      row.appendChild(label)
      row.appendChild(value)
      info.appendChild(row)
    })
  }

  function statusClassFor(text) {
    return text.split(",")[0].replace(/\s/g, "-") || "Unknown"
  }

  function getPreferredThumbnail(video) {
    if (video.thumbnail) return video.thumbnail
    if (video.videoid) return `https://i.ytimg.com/vi/${video.videoid}/hqdefault.jpg`
    return ""
  }

  // ==================== card renderers ====================

  // 书 / 影视通用卡片（封面 + 标题 + 评分 + 信息 + 状态/进度）
  function renderMediaCard(item, cfg) {
    const p = cfg.prefix
    const card = document.createElement("div")
    card.className = p + "-card"

    const header = document.createElement("div")
    header.className = p + "-header"

    const coverWrapper = document.createElement("div")
    coverWrapper.className = p + "-cover-wrapper"

    const coverLink = document.createElement("a")
    coverLink.href = fixFilePath(item.file)
    coverLink.className = p + "-cover-link"
    coverLink.title = item.title || "查看详情"

    const makePlaceholder = function () {
      const ph = document.createElement("div")
      ph.className = p + "-cover-placeholder"
      ph.textContent = cfg.placeholder
      return ph
    }

    const coverSrc = proxyImage(item.封面)
    if (coverSrc) {
      const img = document.createElement("img")
      img.src = coverSrc
      img.alt = item.title || cfg.coverAlt
      img.className = p + "-cover"
      img.loading = "lazy"
      img.onerror = function () {
        this.style.display = "none"
        coverLink.appendChild(makePlaceholder())
      }
      coverLink.appendChild(img)
    } else {
      coverLink.appendChild(makePlaceholder())
    }
    coverWrapper.appendChild(coverLink)
    header.appendChild(coverWrapper)

    const titleSection = document.createElement("div")
    titleSection.className = p + "-title-section"
    const title = document.createElement("h3")
    title.className = p + "-title"
    const titleLink = document.createElement("a")
    titleLink.href = fixFilePath(item.file)
    titleLink.textContent = item.title || "未命名"
    titleLink.title = item.title || "未命名"
    title.appendChild(titleLink)
    titleSection.appendChild(title)
    header.appendChild(titleSection)
    card.appendChild(header)

    if (item.score) {
      const rating = document.createElement("div")
      rating.className = p + "-rating"
      const stars = document.createElement("span")
      stars.className = "stars"
      stars.textContent = item.scoreStar || "⭐".repeat(Math.floor(parseFloat(item.score) / 2))
      const score = document.createElement("span")
      score.className = "score"
      score.textContent = item.score
      rating.appendChild(stars)
      rating.appendChild(score)
      card.appendChild(rating)
    }

    if (item.myRate) {
      const myRating = document.createElement("div")
      myRating.className = "my-rating"
      myRating.textContent = "我的评分: " + item.myRate + "/5"
      card.appendChild(myRating)
    }

    const info = document.createElement("div")
    info.className = p + "-info"
    addInfoRows(info, cfg.infoItems(item))
    if (info.children.length > 0) card.appendChild(info)

    const footer = document.createElement("div")
    footer.className = p + "-footer"
    const statusText = cfg.statusText(item)

    if (cfg.withProgress) {
      const isFinished = /已读完|读完|完成|finished/i.test(statusText)
      if (!isFinished && item.totalPage) {
        const total = parseInt(item.totalPage) || 0
        const current = parseInt(item.currentPage) || 0
        if (total > 0 && current > 0 && current < total) {
          const progress = calculateProgress(current, total)
          const pc = document.createElement("div")
          pc.className = p + "-progress"
          const bar = document.createElement("div")
          bar.className = "progress-bar"
          bar.style.width = progress + "%"
          pc.appendChild(bar)
          footer.appendChild(pc)
          const pt = document.createElement("div")
          pt.className = "progress-text"
          pt.textContent = progress + "%"
          footer.appendChild(pt)
        }
      }
    }

    const status = document.createElement("span")
    status.className = p + "-status status-" + statusClassFor(statusText)
    status.textContent = statusText || "Unknown"
    footer.appendChild(status)
    card.appendChild(footer)

    return card
  }

  // 视频卡片（16:9 缩略图 + 标题 + 日期 + 描述 + 分类）
  function renderVideoCard(video) {
    const card = document.createElement("div")
    card.className = "video-card"

    const coverSrc = getPreferredThumbnail(video)
    if (coverSrc) {
      const coverLink = document.createElement("a")
      coverLink.href = fixFilePath(video.file)
      coverLink.className = "video-cover-link"
      coverLink.title = video.title || "播放视频"

      const img = document.createElement("img")
      img.src = coverSrc
      img.alt = video.title || "视频封面"
      img.className = "video-cover-img"
      img.loading = "lazy"
      img.onerror = function () {
        if (video.videoid && img.src.indexOf("maxresdefault.jpg") !== -1) {
          img.src = `https://i.ytimg.com/vi/${video.videoid}/hqdefault.jpg`
          img.onerror = null
        }
      }
      coverLink.appendChild(img)
      card.appendChild(coverLink)
    }

    const title = document.createElement("h3")
    title.className = "video-card-title"
    const link = document.createElement("a")
    link.href = fixFilePath(video.file)
    link.textContent = video.title || "未命名"
    link.title = video.title || "未命名"
    title.appendChild(link)
    card.appendChild(title)

    if (video.date) {
      const dateEl = document.createElement("div")
      dateEl.className = "video-card-date"
      dateEl.textContent = video.date
      card.appendChild(dateEl)
    }
    if (video.description) {
      const desc = document.createElement("div")
      desc.className = "video-card-desc"
      desc.textContent = video.description
      card.appendChild(desc)
    }
    if (video.category) {
      const cat = document.createElement("span")
      cat.className = "video-card-category"
      cat.textContent = video.category
      card.appendChild(cat)
    }
    return card
  }

  // ==================== generic loader ====================

  // 同一个 index.json 在一次会话里只抓一次（之前每次 SPA 导航都会重新下载）
  const indexCache = {}
  function fetchIndex(url) {
    if (!indexCache[url]) {
      indexCache[url] = fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status)
          return r.json()
        })
        .catch(function (e) {
          delete indexCache[url]
          throw e
        })
    }
    return indexCache[url]
  }

  async function loadGallery(cfg) {
    const containers = document.querySelectorAll(cfg.selector)
    if (containers.length === 0) return

    for (const container of containers) {
      const status = container.getAttribute("data-status")
      const sortBy = container.getAttribute("data-sort") || cfg.defaultSort
      const order = container.getAttribute("data-order") || "DESC"
      const limit = parseInt(container.getAttribute("data-limit")) || null

      container.innerHTML = '<div class="' + cfg.loadingClass + '">' + cfg.loadingText + "</div>"

      try {
        const all = await fetchIndex(cfg.indexUrl)
        let items = cfg.filter(all.slice(), container)

        items.sort(function (a, b) {
          const aVal = a[sortBy] || ""
          const bVal = b[sortBy] || ""
          if (aVal > bVal) return order === "DESC" ? -1 : 1
          if (aVal < bVal) return order === "DESC" ? 1 : -1
          return 0
        })

        if (limit && limit > 0) items = items.slice(0, limit)

        if (items.length === 0) {
          const cls = cfg.emptyClass || cfg.errorClass
          container.innerHTML = '<div class="' + cls + '">' + cfg.emptyText(status) + "</div>"
          continue
        }

        const grid = document.createElement("div")
        grid.className = cfg.gridClass
        items.forEach(function (item) {
          grid.appendChild(cfg.render(item))
        })
        container.innerHTML = ""
        container.appendChild(grid)
      } catch (error) {
        console.error("Error loading " + cfg.prefix + ":", error)
        container.innerHTML =
          '<div class="' + cfg.errorClass + '">❌ 加载失败: ' + error.message + "</div>"
      }
    }
  }

  // ==================== per-type config ====================

  const movieTagSet = ["movies", "movie", "teleplay", "tv", "电影", "电视剧"]
  const isMovieTag = function (t) {
    return movieTagSet.indexOf(String(t).toLowerCase()) !== -1
  }
  const movieStatusOf = function (m) {
    return String(m.观看状态 || m.状态 || m.阅读状态 || m.status || "").trim()
  }

  const bookConfig = {
    prefix: "book",
    selector: "[data-book-query]",
    indexUrl: "/book-index.json",
    gridClass: "book-grid",
    loadingClass: "book-query-loading",
    loadingText: "📚 加载书籍中...",
    errorClass: "book-query-error",
    defaultSort: "添加时间",
    placeholder: "📚",
    coverAlt: "书籍封面",
    withProgress: true,
    infoItems: function (book) {
      const days = calculateDays(book.开始时间, book.结束阅读, book.添加时间)
      return [
        { label: "原名", value: book.originalTitle },
        { label: "作者", value: book.author },
        { label: "出版", value: book.publishDate },
        { label: "添加", value: book.添加时间 },
        { label: "开始", value: book.开始时间 },
        { label: "完成", value: book.结束阅读 },
        { label: "用时", value: days > 0 ? days + " 天" : null },
        {
          label: "进度",
          value: book.totalPage ? (book.currentPage || 0) + "/" + book.totalPage + " 页" : null,
        },
      ]
    },
    statusText: function (book) {
      return String(book.阅读状态 || "").trim()
    },
    emptyText: function (status) {
      return '😔 没有找到状态为"' + (status || "任何") + '"的书籍'
    },
    filter: function (books, container) {
      const excludeMovies = container.getAttribute("data-exclude-movies") !== "false"
      const status = container.getAttribute("data-status")
      let result = books
      if (excludeMovies) {
        result = result.filter(function (b) {
          return !(b.tags || []).some(isMovieTag)
        })
      }
      if (status) {
        result = result.filter(function (b) {
          return String(b.阅读状态 || "")
            .split(",")
            .map(function (s) {
              return s.trim()
            })
            .includes(status)
        })
      }
      return result
    },
    render: function (item) {
      return renderMediaCard(item, bookConfig)
    },
  }

  const movieConfig = {
    prefix: "movie",
    selector: "[data-movie-query]",
    indexUrl: "/movie-index.json",
    gridClass: "movie-grid",
    loadingClass: "movie-query-loading",
    loadingText: "🎬 加载影片中...",
    errorClass: "movie-query-error",
    defaultSort: "添加时间",
    placeholder: "🎬",
    coverAlt: "影片海报",
    withProgress: false,
    infoItems: function (m) {
      return [
        { label: "原名", value: m.originalTitle },
        { label: "地区", value: m.country },
        { label: "导演", value: m.director },
        { label: "类型", value: m.genre },
        { label: "上映时间", value: m.releaseDate || m.datePublished },
        { label: "添加时间", value: m.添加时间 },
      ]
    },
    statusText: movieStatusOf,
    emptyText: function (status) {
      return status ? '😔 没有找到状态为"' + status + '"的影片' : "😔 没有找到符合条件的影片"
    },
    filter: function (movies, container) {
      const type = container.getAttribute("data-type")
      const status = container.getAttribute("data-status")
      let result = movies.filter(function (m) {
        return (m.tags || []).some(isMovieTag)
      })
      if (type === "movies") {
        result = result.filter(function (m) {
          return (m.tags || []).some(function (t) {
            const x = String(t).toLowerCase()
            return x === "movies" || x === "movie" || x === "电影"
          })
        })
      } else if (type === "teleplay") {
        result = result.filter(function (m) {
          return (m.tags || []).some(function (t) {
            const x = String(t).toLowerCase()
            return x === "teleplay" || x === "tv" || x === "电视剧"
          })
        })
      }
      if (status) {
        result = result.filter(function (m) {
          return movieStatusOf(m)
            .split(",")
            .map(function (s) {
              return s.trim()
            })
            .includes(status)
        })
      }
      return result
    },
    render: function (item) {
      return renderMediaCard(item, movieConfig)
    },
  }

  const videoConfig = {
    prefix: "video",
    selector: "[data-video-query]",
    indexUrl: "/video-index.json",
    gridClass: "video-grid",
    loadingClass: "video-query-loading",
    loadingText: "🎬 加载视频中...",
    errorClass: "video-query-error",
    emptyClass: "video-query-empty",
    defaultSort: "date",
    emptyText: function () {
      return "暂无视频"
    },
    filter: function (videos, container) {
      const category = container.getAttribute("data-category")
      const search = container.getAttribute("data-search")
      let result = videos
      if (category) {
        result = result.filter(function (v) {
          return v.category === category
        })
      }
      if (search) {
        const q = search.toLowerCase()
        result = result.filter(function (v) {
          return (
            (v.title || "").toLowerCase().indexOf(q) !== -1 ||
            (v.description || "").toLowerCase().indexOf(q) !== -1 ||
            (v.category || "").toLowerCase().indexOf(q) !== -1
          )
        })
      }
      return result
    },
    render: renderVideoCard,
  }

  // ==================== init ====================

  function renderAll() {
    loadGallery(bookConfig)
    loadGallery(movieConfig)
    loadGallery(videoConfig)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAll)
  } else {
    renderAll()
  }

  // 脚本现在按页面条件加载，可能被 SPA 重复插入；用全局标志确保 nav 只绑定一次
  if (!window.__galleryNavBound) {
    window.__galleryNavBound = true
    document.addEventListener("nav", renderAll)
  }
})()
