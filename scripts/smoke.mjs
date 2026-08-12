#!/usr/bin/env node
// scripts/smoke.mjs
// 构建产物的冒烟检查:用真浏览器打开 public/ 里所有「靠 JS 渲染」的页面,断言模块真的出来了。
//
// 为什么必须跑浏览器:现有的 verify-index / check-en 都是静态检查——只看文件。
// 但这站的播放器和画廊是运行时拿 location.pathname 去 *-index.json 查表拼出来的,
// HTML 里只有一个空容器。曾经 video-player.js 漏了剥 /en 前缀,靠索引取源的英文视频页
// (010/011 整块空白、009 丢了 YouTube 源)坏了近两个月:HTML 中英一字不差、索引没错、
// 链接不 404,静态检查全说正常。这类 bug 只有把页面跑起来才看得见。
//
// 三类断言:
//   1. 播放器  每个 .video-player-container 必须 data-player-ready=true 且内含播放器元素
//   2. 画廊    每个 data-*-query 容器不能卡在 loading/error 态
//   3. 中英对称(最关键)  有 /en 镜像的页面,播放器源 ID 和各画廊卡片数必须与中文页一致
// 外加:localhost 请求不能 404、控制台不能有 error。
//
// 外部主机(youtube/bilibili/ytimg/weserv)一律拦截并伪造空响应:检查的是本站渲染逻辑,
// 不该依赖外网连通性,也不该让 CI 里的网络抖动变成假报警。
//
// 用法:
//   node scripts/smoke.mjs                  # 起本地静态服务跑 public/
//   SMOKE_BASE_URL=https://jz21.eu.org ...  # 直接打线上(线上巡检用)
// 退出码:0=全过;1=有断言失败(quartz-push.sh 的 set -e 会中止 push)。

import fs from "node:fs"
import path from "node:path"
import http from "node:http"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.join(__dirname, "..")
const PUBLIC = path.join(REPO, "public")

// 打线上时降并发、放宽导航超时:34 页 × 4 并发打同一个站容易被 CF 限速,
// 导航超时会被记成"打开页面失败",那是假报警,不是站坏了。
// 线上是真实网络:实测这台机器到 CF 的单个请求 TTFB 就要 2~5 秒,一页十几个同源资源
// 叠起来 domcontentloaded 能到 20~35 秒(不装任何请求拦截也一样)。超时给得不够
// 就会把慢当成坏,而一个会误报的护栏很快就会被忽略。
const ONLINE = !!process.env.SMOKE_BASE_URL
const CONCURRENCY = ONLINE ? 2 : 4
const NAV_TIMEOUT = ONLINE ? 90000 : 20000
const READY_TIMEOUT = 15000

// 容器选择器 → 渲染完成后卡片所在的容器 class(gallery.js 里的 gridClass)
const GALLERY_KINDS = [
  { name: "video", selector: "[data-video-query]", grid: "video-grid" },
  { name: "book", selector: "[data-book-query]", grid: "book-grid" },
  { name: "movie", selector: "[data-movie-query]", grid: "movie-grid" },
  { name: "image", selector: "[data-image-query]", grid: "topic-list" },
]

// 本地没有 CF 的 /cdn-cgi/trace(地理判断用),脚本自己 catch 了,404 属预期
const IGNORED_404 = [/\/cdn-cgi\/trace$/]

// 「外部」= 不属于本次被测站点的源。必须按 base 的源来判,不能写死 localhost:
// 巡检线上时 base 是 https://jz21.eu.org,写死 localhost 会把站点自己也当外部拦掉、
// 伪造成空响应,整轮巡检等于什么都没测。
function isInternal(url, origin) {
  return url.startsWith(origin)
}

// ===== 极简静态服务:模拟 CF Pages 的无扩展名路由 =====
function startServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0])
    const candidates = [
      path.join(PUBLIC, rel),
      path.join(PUBLIC, rel + ".html"),
      path.join(PUBLIC, rel, "index.html"),
    ]
    for (const file of candidates) {
      if (!file.startsWith(PUBLIC)) break // 防目录穿越
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { "Content-Type": contentType(file) })
        fs.createReadStream(file).pipe(res)
        return
      }
    }
    res.writeHead(404).end("not found")
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` })
    })
  })
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase()
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".woff2": "font/woff2",
    }[ext] || "application/octet-stream"
  )
}

// ===== 挑出需要检查的页面:HTML 里含播放器容器或画廊容器 =====
function collectTargets() {
  const needles = ["video-player-container", ...GALLERY_KINDS.map((k) => k.selector.slice(1, -1))]
  const targets = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith(".html")) {
        const html = fs.readFileSync(full, "utf-8")
        if (needles.some((n) => html.includes(n))) {
          const url =
            "/" +
            path
              .relative(PUBLIC, full)
              .replace(/\\/g, "/")
              .replace(/\.html$/, "")
          targets.push(url.replace(/\/index$/, "") || "/")
        }
      }
    }
  }
  walk(PUBLIC)
  return targets.sort()
}

// ===== 打开一页,收集「签名」:渲染结果的可比较快照 =====
async function inspect(context, base, url, origin) {
  const page = await context.newPage()
  const consoleErrors = []
  const failedRequests = []

  // 只收 JS 层面的错误。浏览器给网络失败也发一条 console error,但那条不带 URL、
  // 没法按 IGNORED_404 放行,而网络失败已由下面的 response 监听按 URL 精确记账了。
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) {
      consoleErrors.push(msg.text())
    }
  })
  // 未捕获异常:比如哪天 window.QuartzLang 没加载,gallery.js 会在这里炸出来
  page.on("pageerror", (err) => consoleErrors.push(`未捕获异常:${err.message}`))
  page.on("response", (res) => {
    const u = res.url()
    if (!isInternal(u, origin)) return
    if (res.status() >= 400 && !IGNORED_404.some((re) => re.test(u))) {
      failedRequests.push(`${res.status()} ${u.replace(base, "")}`)
    }
  })

  try {
    // 导航失败重试一次:线上偶发的网络抖动不该变成"页面坏了"
    try {
      await page.goto(base + url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT })
    } catch {
      await page.goto(base + url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT })
    }

    // 等渲染完成。注意必须等「正面信号」(出现了网格/空态/错误态),不能等「loading 消失」——
    // 脚本还没开始跑时容器里同样没有 loading 元素,那样会在渲染前就抓快照,把好页面误判成 0 卡片。
    // 超时不抛,让下面的断言去报具体是卡住了还是没渲染。
    await page
      .waitForFunction(
        (kinds) => {
          const players = [...document.querySelectorAll(".video-player-container")]
          if (players.some((p) => p.getAttribute("data-player-ready") !== "true")) return false
          for (const k of kinds) {
            for (const c of document.querySelectorAll(k.selector)) {
              const done = c.querySelector(`.${k.grid}, [class$='-empty'], [class$='-error']`)
              if (!done) return false
            }
          }
          return true
        },
        GALLERY_KINDS,
        { timeout: READY_TIMEOUT },
      )
      .catch(() => {})

    const signature = await page.evaluate((kinds) => {
      const players = [...document.querySelectorAll(".video-player-container")].map((c) => ({
        ready: c.getAttribute("data-player-ready") === "true",
        placeholder: c.getAttribute("data-player-placeholder") === "true",
        youtube: c.getAttribute("data-youtube") || "",
        bilibili: c.getAttribute("data-bilibili") || "",
        hasFrame: !!c.querySelector("iframe, lite-youtube"),
      }))
      const galleries = {}
      for (const k of kinds) {
        const containers = [...document.querySelectorAll(k.selector)]
        if (containers.length === 0) continue
        galleries[k.name] = containers.map((c) => ({
          cards: [...c.querySelectorAll("." + k.grid)].reduce(
            (n, grid) => n + grid.children.length,
            0,
          ),
          stuck: !!c.querySelector("[class$='-loading']"),
          errored: !!c.querySelector("[class$='-error']"),
          rendered: !!c.querySelector(`.${k.grid}, [class$='-empty'], [class$='-error']`),
        }))
      }
      return { players, galleries }
    }, GALLERY_KINDS)

    return { url, ...signature, consoleErrors, failedRequests }
  } finally {
    await page.close()
  }
}

// ===== 断言 =====
function checkPage(sig) {
  const problems = []
  sig.players.forEach((p, i) => {
    const at = sig.players.length > 1 ? ` #${i + 1}` : ""
    if (!p.ready) problems.push(`播放器${at}没初始化(data-player-ready 不是 true)`)
    // 占位态仍算失败:它只该出现在本地 QUARTZ_KEEP_DRAFTS=1 的草稿预览里,
    // 进了 public/ 就说明一篇没有播放源的页面正要上线
    else if (p.placeholder)
      problems.push(
        `播放器${at}停在「视频即将发布」占位:没有任何视频源 ID。视频已发就补 videoid/bilibiliid,没发就把 draft 改回 "true"`,
      )
    else if (!p.hasFrame) problems.push(`播放器${at}初始化了但没渲染出播放元素`)
    else if (!p.youtube && !p.bilibili) problems.push(`播放器${at}没拿到任何视频源 ID`)
  })
  for (const [name, containers] of Object.entries(sig.galleries)) {
    containers.forEach((c, i) => {
      const at = containers.length > 1 ? ` #${i + 1}` : ""
      if (c.stuck) problems.push(`${name} 画廊${at}卡在加载中`)
      else if (c.errored) problems.push(`${name} 画廊${at}渲染报错`)
      else if (!c.rendered) problems.push(`${name} 画廊${at}没被渲染(容器还是空的)`)
    })
  }
  for (const e of sig.consoleErrors) problems.push(`控制台 error:${e}`)
  for (const r of sig.failedRequests) problems.push(`请求失败:${r}`)
  return problems
}

// 中英对称:英文镜像页的渲染结果必须和中文原页一致(这条是本脚本的核心)
function checkMirror(enSig, zhSig) {
  const problems = []
  if (enSig.players.length !== zhSig.players.length) {
    problems.push(`播放器数量与中文页不符(英 ${enSig.players.length} / 中 ${zhSig.players.length})`)
  } else {
    enSig.players.forEach((p, i) => {
      const z = zhSig.players[i]
      if (p.youtube !== z.youtube || p.bilibili !== z.bilibili) {
        problems.push(
          `播放器视频源与中文页不符(英 yt=${p.youtube || "空"}/bili=${p.bilibili || "空"},` +
            ` 中 yt=${z.youtube || "空"}/bili=${z.bilibili || "空"})`,
        )
      }
    })
  }
  for (const [name, zhContainers] of Object.entries(zhSig.galleries)) {
    const enContainers = enSig.galleries[name] || []
    const zhCards = zhContainers.reduce((n, c) => n + c.cards, 0)
    const enCards = enContainers.reduce((n, c) => n + c.cards, 0)
    if (zhCards > 0 && enCards !== zhCards) {
      problems.push(`${name} 画廊卡片数与中文页不符(英 ${enCards} / 中 ${zhCards})`)
    }
  }
  return problems
}

// 优先用系统已装的 Chrome(channel:"chrome"),回退到 playwright 自带的 chromium。
// 为什么反着来:`npx playwright install chromium` 要从 CDN 拉 ~150MB,本机这条链路经常被
// 重置、装不上(同 ~/fix-claude-native.sh 治的那个毛病)。系统 Chrome 本来就有,渲染引擎
// 一样,省掉一个装不上就整条护栏跑不起来的前置依赖。
async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome" })
  } catch (err) {
    try {
      return await chromium.launch()
    } catch {
      console.error(
        "❌ 没有可用的浏览器:系统 Chrome 打不开,playwright 自带 chromium 也没装。\n" +
          "   装一个即可:npx playwright install chromium",
      )
      throw err
    }
  }
}

// ===== 主流程 =====
async function main() {
  // 待检页面清单永远来自本地 public/(线上没法枚举页面)。巡检线上时它只当"页面名单"用,
  // 名单略旧也无妨:线上真删了某页会以 404 报出来,正是想抓的。
  const externalBase = process.env.SMOKE_BASE_URL?.replace(/\/$/, "")
  if (!fs.existsSync(PUBLIC)) {
    console.error("❌ 没有 public/(页面清单从这里来),先跑 npx quartz build")
    process.exit(1)
  }

  const targets = collectTargets()
  const served = externalBase ? null : await startServer()
  const base = externalBase || served.base
  const origin = new URL(base).origin
  console.log(`🔎 冒烟检查:${targets.length} 个含动态模块的页面 @ ${origin}`)

  const browser = await launchBrowser()
  const context = await browser.newContext()
  // 站外请求一律 abort:检查的是本站渲染逻辑,不测 YouTube/B站/weserv 的连通性,
  // 也不让外网抖动变成假报警。判定按 base 的源,所以本地和线上两种模式都成立。
  // 用 abort 而不是伪造 200 空响应:空响应会让带 SRI 的站外脚本(CF Insights beacon)
  // 校验失败,在控制台刷出一条真·error,反倒制造假报警;abort 只产生一条被过滤掉的
  // "Failed to load resource",干净。
  await context.route(
    (url) => !isInternal(url.toString(), origin),
    (route) => route.abort(),
  )

  const signatures = new Map()
  const queue = [...targets]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const url = queue.shift()
        try {
          signatures.set(url, await inspect(context, base, url, origin))
        } catch (err) {
          signatures.set(url, {
            url,
            players: [],
            galleries: {},
            consoleErrors: [`打开页面失败:${err.message}`],
            failedRequests: [],
          })
        }
      }
    }),
  )

  const zhCounterpart = (url) =>
    url === "/en" || url.startsWith("/en/") ? url.replace(/^\/en/, "") || "/" : null

  const problemsOf = (url) => {
    const sig = signatures.get(url)
    const problems = checkPage(sig)
    const zhUrl = zhCounterpart(url)
    if (zhUrl) {
      const zhSig = signatures.get(zhUrl)
      if (zhSig) problems.push(...checkMirror(sig, zhSig))
    }
    return problems
  }

  // 复核:首轮失败的页面逐页重测,两次都失败才算数。
  // 首轮是并发跑的,网络抖动、导航超时、渲染没赶上都可能让好页面偶发翻红;误报会让人
  // 慢慢开始忽略告警,那这道护栏就白建了。复核串行、不抢带宽,只多花失败页数 × 几十秒。
  // 英文页翻红时把对应中文页也一并重测:中英对称是拿两次测量作差,基准本身也可能是抖的。
  const suspects = targets.filter((url) => problemsOf(url).length > 0)
  if (suspects.length > 0) {
    const recheck = new Set()
    for (const url of suspects) {
      recheck.add(url)
      const zhUrl = zhCounterpart(url)
      if (zhUrl && signatures.has(zhUrl)) recheck.add(zhUrl)
    }
    console.log(`⏳ 首轮 ${suspects.length} 页有问题,逐页复核 ${recheck.size} 页...`)
    for (const url of recheck) {
      try {
        signatures.set(url, await inspect(context, base, url, origin))
      } catch (err) {
        signatures.set(url, {
          url,
          players: [],
          galleries: {},
          consoleErrors: [`打开页面失败:${err.message}`],
          failedRequests: [],
        })
      }
    }
  }

  await browser.close()
  served?.server.close()

  const failures = []
  for (const url of suspects) {
    const problems = problemsOf(url)
    if (problems.length) failures.push({ url, problems })
  }

  if (failures.length === 0) {
    const flaky = suspects.length > 0 ? `(${suspects.length} 页首轮翻红,复核后确认是抖动)` : ""
    console.log(`✅ 冒烟检查通过:${targets.length} 页全部正常渲染${flaky}\n`)
    return
  }

  console.error(`\n❌ 冒烟检查失败:${failures.length}/${targets.length} 页有问题\n`)
  for (const { url, problems } of failures) {
    console.error(`  ${url}`)
    for (const p of problems) console.error(`     · ${p}`)
  }
  console.error("")
  process.exit(1)
}

main().catch((err) => {
  console.error("❌ 冒烟检查自身出错:", err)
  process.exit(1)
})
