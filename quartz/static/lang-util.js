// 站点语言前缀的唯一真相。
//
// 英文页是中文页的镜像:content/en/<同路径> → URL 多一层 /en 前缀,
// 但所有索引(video-index.json / books-index.json / movies-index.json)都只按
// 中文原文的路径建条目。于是凡是「拿当前 URL 去索引里查」或「把索引里的路径
// 拼成链接」的代码,都必须处理这层前缀 —— 这是个散落在多个脚本里的隐含约定。
//
// 历史教训:gallery.js 处理了、video-player.js 漏了 → 10 个英文视频页的播放器
// 静默空白近两个月(HTML 里容器还在,只是运行时查不到源,静态检查全都说正常)。
// 同一个不变量写两遍必然漏一处,所以收到这里,新组件一律用 window.QuartzLang,
// 不要再就地写 startsWith("/en/")。
//
// 加载方式:Head.tsx 里以 <script defer> 排在 gallery.js / video-player.js 之前;
// defer 脚本按文档顺序执行,所以消费方运行时 window.QuartzLang 一定已就位。
;(function () {
  "use strict"

  var EN_PREFIX_RE = /^\/en(?=\/|$)/

  // 当前页是不是英文镜像页(/en 或 /en/... 都算)
  function isEnPage(pathname) {
    var p = pathname || (typeof location !== "undefined" ? location.pathname : "")
    return EN_PREFIX_RE.test(p)
  }

  // 剥掉 /en 前缀,换算成索引里那条中文原文的路径。/en 本身 → /
  function stripLangPrefix(pathname) {
    if (!pathname) return ""
    return pathname.replace(EN_PREFIX_RE, "") || "/"
  }

  // 反向:把索引里的中文原文路径拼成英文页链接(已带前缀则原样返回)
  function withLangPrefix(pathname) {
    if (!pathname) return pathname
    return isEnPage(pathname) ? pathname : "/en" + pathname
  }

  window.QuartzLang = {
    isEnPage: isEnPage,
    stripLangPrefix: stripLangPrefix,
    withLangPrefix: withLangPrefix,
  }
})()
