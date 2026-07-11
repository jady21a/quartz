// 记住手动语言选择:点过「中/EN」后写入 langPref,
// 首页的自动语言分流脚本(见 LanguageSwitch.tsx)以它为最高优先级。
document.addEventListener("nav", () => {
  for (const el of document.getElementsByClassName("lang")) {
    const lang = el.getAttribute("data-lang")
    if (!(el instanceof HTMLAnchorElement) || !lang) continue
    const savePref = () => localStorage.setItem("langPref", lang)
    el.addEventListener("click", savePref)
    window.addCleanup(() => el.removeEventListener("click", savePref))
  }
})
