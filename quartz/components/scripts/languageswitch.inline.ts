// 语言偏好持久化:
// - 落在英文页时自动写 langPref=en,使得从英文跳到无译文中文页后 Explorer 仍显示英文树
// - 点击中/EN 链接时覆盖写入,显式切换优先级最高
// - 首页自动分流脚本(见 LanguageSwitch.tsx)以 langPref 为最高优先级
document.addEventListener("nav", () => {
  const slug = document.body.dataset.slug ?? ""
  if (slug === "en" || slug.startsWith("en/")) {
    localStorage.setItem("langPref", "en")
  }

  for (const el of document.getElementsByClassName("lang")) {
    const lang = el.getAttribute("data-lang")
    if (!(el instanceof HTMLAnchorElement) || !lang) continue
    const savePref = () => localStorage.setItem("langPref", lang)
    el.addEventListener("click", savePref)
    window.addCleanup(() => el.removeEventListener("click", savePref))
  }
})
