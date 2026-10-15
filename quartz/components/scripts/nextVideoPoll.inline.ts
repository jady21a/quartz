// 「下一期想看哪个」投票框的行为(组件见 NextVideoPoll.tsx,后端见 busuanzi Worker 的 /poll)。
// - 没投过:只显示选项按钮,不显示票数(避免新访客一进来先看见「0 票」)
// - 投过 / 已截止:显示每项票数条,自己那项高亮;投过的人点别的项即改投
// - 本地预览(localhost)打本地 `wrangler dev`,不碰线上票箱
const ENDPOINT =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:8788"
    : "https://count.jz21.eu.org"

type Poll = {
  id: string
  question: string
  closes: string
  open: boolean
  options: { id: string; label: string }[]
  voted: string | null
  counts?: Record<string, number>
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function render(box: HTMLElement, poll: Poll, busy = false) {
  box.replaceChildren()
  box.appendChild(el("h3", "poll-question", poll.question))

  const counts = poll.counts
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  const list = el("div", "poll-options")

  for (const opt of poll.options) {
    const btn = el("button", "poll-option")
    btn.type = "button"
    btn.disabled = busy || !poll.open
    if (poll.voted === opt.id) btn.classList.add("is-mine")

    if (counts) {
      const n = counts[opt.id] ?? 0
      const pct = total ? Math.round((n / total) * 100) : 0
      const bar = el("span", "poll-bar")
      bar.style.width = pct + "%"
      btn.appendChild(bar)
      btn.appendChild(el("span", "poll-label", opt.label))
      btn.appendChild(el("span", "poll-count", `${pct}% · ${n}`))
    } else {
      btn.appendChild(el("span", "poll-label", opt.label))
    }

    if (poll.open && poll.voted !== opt.id) {
      btn.onclick = () => vote(box, poll, opt.id)
    }
    list.appendChild(btn)
  }
  box.appendChild(list)

  const [, m, d] = poll.closes.split("-").map(Number)
  const meta = !poll.open
    ? `已截止 · 共 ${total} 票`
    : counts
      ? `共 ${total} 票 · ${m}/${d} 截止 · 点别的选项可以改投`
      : `投完显示结果 · ${m}/${d} 截止`
  box.appendChild(el("p", "poll-meta", meta))
  box.hidden = false
}

async function vote(box: HTMLElement, poll: Poll, option: string) {
  render(box, poll, true)
  try {
    const r = await fetch(ENDPOINT + "/poll", {
      method: "POST",
      body: new URLSearchParams({ o: option }),
      cache: "no-store",
    })
    if (!r.ok) throw new Error("HTTP " + r.status)
    render(box, (await r.json()) as Poll)
  } catch {
    render(box, poll)
    box.appendChild(el("p", "poll-meta poll-error", "没投上,稍后再试一下"))
  }
}

document.addEventListener("nav", async () => {
  const box = document.querySelector<HTMLElement>(".next-video-poll")
  if (!box) return
  try {
    const r = await fetch(ENDPOINT + "/poll", { cache: "no-store" })
    if (!r.ok) return
    // SPA 换页期间请求才回来:旧页的壳已不在文档里,丢掉
    if (!box.isConnected) return
    render(box, (await r.json()) as Poll)
  } catch {
    // 后端不可用:保持隐藏
  }
})
