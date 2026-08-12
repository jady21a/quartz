#!/usr/bin/env node
// scripts/preview-server.mjs
// 本地 HTTPS 静态服务,把 public/ 用真域名(jz21.eu.org)托出来,专供录屏演示。
//
// 为什么要它:录视频时地址栏出现 localhost:8080,会把「我的博客」演成「我电脑上的一个
// 网页」,而且暴露了这页当时还没上线。配合 /etc/hosts 把 jz21.eu.org 指到 127.0.0.1 +
// mkcert 签的本地证书,地址栏就是 https://jz21.eu.org/... 带锁头,站内跳转也全都对。
// 这不算骗人:观众照地址栏敲进来是在视频发布之后,那时页面本来就上线了——前提是你按
// 顺序发(页面随视频一起解草稿上线)。
//
// 路由规则跟 scripts/smoke.mjs 里那套一致(模拟 CF Pages 的无扩展名路由),两边都改才对齐。
//
// 不要手动跑这个脚本,用 ~/blog-preview.sh on —— hosts 改动、.wip 护栏和索引还原都在那里,
// 少一步就会留下「hosts 没删」或「带草稿的索引被推上线」的坑。
//
// 环境变量:
//   PREVIEW_PORT   监听端口(默认 443;443 需要 sudo)
//   PREVIEW_CERT   证书路径   PREVIEW_KEY 私钥路径(默认 ~/.blog-preview-certs/)

import fs from "node:fs"
import path from "node:path"
import https from "node:https"
import os from "node:os"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, "../public")
const PORT = Number(process.env.PREVIEW_PORT || 443)
const CERT_DIR = path.join(os.homedir(), ".blog-preview-certs")
const CERT = process.env.PREVIEW_CERT || path.join(CERT_DIR, "jz21.eu.org.pem")
const KEY = process.env.PREVIEW_KEY || path.join(CERT_DIR, "jz21.eu.org-key.pem")

for (const [label, file] of [
  ["证书", CERT],
  ["私钥", KEY],
]) {
  if (!fs.existsSync(file)) {
    console.error(`❌ 找不到${label}:${file}\n   先跑 ~/blog-preview.sh cert 生成`)
    process.exit(1)
  }
}
if (!fs.existsSync(path.join(PUBLIC, "index.html"))) {
  console.error(`❌ public/ 里没有构建产物,先跑一次构建(~/blog-preview.sh on 会自动构建)`)
  process.exit(1)
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
      ".xml": "application/xml; charset=utf-8",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".ico": "image/x-icon",
      ".woff2": "font/woff2",
      ".woff": "font/woff",
      ".ttf": "font/ttf",
    }[ext] || "application/octet-stream"
  )
}

const server = https.createServer(
  { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) },
  (req, res) => {
    let rel
    try {
      rel = decodeURIComponent(req.url.split("?")[0])
    } catch {
      res.writeHead(400).end("bad request")
      return
    }
    const candidates = [
      path.join(PUBLIC, rel),
      path.join(PUBLIC, rel + ".html"),
      path.join(PUBLIC, rel, "index.html"),
    ]
    for (const file of candidates) {
      if (!file.startsWith(PUBLIC)) break // 防目录穿越
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        // 演示用:禁缓存,免得改一版内容浏览器还拿旧的,录到一半自我怀疑
        res.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-store" })
        fs.createReadStream(file).pipe(res)
        return
      }
    }
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
    const notFound = path.join(PUBLIC, "404.html")
    if (fs.existsSync(notFound)) fs.createReadStream(notFound).pipe(res)
    else res.end("not found")
  },
)

server.on("error", (err) => {
  if (err.code === "EACCES") console.error(`❌ 端口 ${PORT} 需要 root:用 sudo 跑,或换 PREVIEW_PORT`)
  else if (err.code === "EADDRINUSE") console.error(`❌ 端口 ${PORT} 被占用(上一次预览没关干净?)`)
  else console.error("❌", err.message)
  process.exit(1)
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`🎬 预览服务已起:https://jz21.eu.org${PORT === 443 ? "" : ":" + PORT}/`)
  console.log(`   托的是 ${PUBLIC}`)
})

// 到点自己退出,让 blog-preview.sh 的 trap 接着收尾(hosts/.wip/索引)。
// 定时器放在这边而不是 shell 里:shell 要终止这个 root 进程得再 sudo,几小时后时间戳
// 早过期,没 tty 就卡在密码提示上,等于没收尾。
const MAX_MINUTES = Number(process.env.PREVIEW_MAX_MINUTES || 0)
if (MAX_MINUTES > 0) {
  setTimeout(
    () => {
      console.log(`\n⏰ 到 ${MAX_MINUTES} 分钟了,预览服务自动退出`)
      server.close(() => process.exit(0))
      // 还有连接挂着就别等了,收尾比优雅重要
      setTimeout(() => process.exit(0), 2000).unref()
    },
    MAX_MINUTES * 60 * 1000,
  ).unref?.()
}
