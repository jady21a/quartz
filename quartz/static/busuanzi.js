// 访问量计数客户端:调用自托管的 busuanzi Worker(count.jz21.eu.org)上报访问,
// 数据只给站长本人的私密面板(count.jz21.eu.org/stats)看。后端见 workers/busuanzi/。
//
// SHOW_TO_VISITORS:是否把数字回填到页面上给访客看。当前 false = 只上报、不展示,
// 页面里的计数 span 保持 hidden(首页「本站累计…」那行、文章页「N 次阅读」都不出现)。
// 想让访客看到时改成 true 即可,SSR 的 span 早就在页面里了,不用动别的文件。
//
// SPA 说明:Quartz 的 `nav` 事件在首次整页加载和每次 SPA 导航都会派发。为避免「整页加载
// 时初始 nav + 脚本自身初始调用」把同一页数两次,用 lastPath 去重(仅拦截同一路径的连续
// 触发);真正切到别的页 / 再切回来都会各记一次,符合 PV 语义。Worker 挂了则静默不显示。
;(function () {
  "use strict"
  var ENDPOINT = "https://count.jz21.eu.org"
  var SHOW_TO_VISITORS = false
  var lastPath = null

  function fmt(n) {
    try {
      return Number(n).toLocaleString("zh-CN")
    } catch (e) {
      return String(n)
    }
  }

  function fill(id, value) {
    var el = document.getElementById(id)
    if (el) el.textContent = fmt(value)
  }

  function reveal(selector) {
    var el = document.querySelector(selector)
    if (el) el.removeAttribute("hidden")
  }

  function tick() {
    var path = window.location.pathname
    if (path === lastPath) return
    lastPath = path

    // 每页都计数(哪怕本页不显示计数):否则列表/导览页的浏览不会计入全站总数。
    // 显示与否由页面上有没有对应 span 决定(全站数只在首页放,单页阅读数只在文章放)。
    fetch(ENDPOINT + "/?path=" + encodeURIComponent(path), {
      method: "GET",
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status)
        return r.json()
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error)
        // 只上报模式:拿到数就丢掉,不回填、不揭开 span,访客看不到任何数字。
        if (!SHOW_TO_VISITORS) return
        fill("busuanzi_site_pv", data.site_pv)
        fill("busuanzi_site_uv", data.site_uv)
        fill("busuanzi_page_pv", data.page_pv)
        reveal(".busuanzi-site")
        reveal(".busuanzi-page")
      })
      .catch(function () {
        // 后端不可用:保持隐藏,不显示占位符
      })
  }

  document.addEventListener("nav", tick)
  // nav 可能在本脚本绑定前就已派发(首屏),兜底立即跑一次;lastPath 去重防重复计数。
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick)
  } else {
    tick()
  }
})()
