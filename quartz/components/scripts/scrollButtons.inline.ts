// 「回到顶部 / 回到底部」浮动按钮的行为。
// - 滚过 THRESHOLD 后整组淡入;到顶隐藏「回顶部」、到底隐藏「回底部」。
// - scroll / resize 监听在模块顶层只注册一次(脚本全局加载一次,SPA 换页不重跑),
//   元素引用在每次 nav(换页会重建 afterBody 里的按钮)时刷新。
const THRESHOLD = 200

let container: HTMLElement | null = null
let topBtn: HTMLElement | null = null
let bottomBtn: HTMLElement | null = null

function updateScrollButtons() {
  if (!container) return
  const y = window.scrollY
  const max = document.documentElement.scrollHeight - window.innerHeight
  container.classList.toggle("visible", y > THRESHOLD)
  topBtn?.classList.toggle("is-hidden", y < THRESHOLD)
  bottomBtn?.classList.toggle("is-hidden", max - y < THRESHOLD)
}

window.addEventListener("scroll", updateScrollButtons, { passive: true })
window.addEventListener("resize", updateScrollButtons, { passive: true })

document.addEventListener("nav", () => {
  container = document.querySelector(".scroll-buttons")
  topBtn = container?.querySelector(".scroll-to-top") ?? null
  bottomBtn = container?.querySelector(".scroll-to-bottom") ?? null

  // 用 onclick 赋值(幂等),即便同一元素被重复绑定也不会叠加多个监听
  if (topBtn) {
    topBtn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" })
  }
  if (bottomBtn) {
    bottomBtn.onclick = () =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })
  }

  updateScrollButtons()
})
