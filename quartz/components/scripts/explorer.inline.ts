import { FileTrieNode } from "../../util/fileTrie"
import { FullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { ContentDetails } from "../../plugins/emitters/contentIndex"

type MaybeHTMLElement = HTMLElement | undefined

interface ParsedOptions {
  folderClickBehavior: "collapse" | "link"
  folderDefaultState: "collapsed" | "open"
  useSavedState: boolean
  sortFn: (a: FileTrieNode, b: FileTrieNode) => number
  filterFn: (node: FileTrieNode) => boolean
  mapFn: (node: FileTrieNode) => void
  order: "sort" | "filter" | "map"[]
}

type FolderState = {
  path: string
  collapsed: boolean
}

let currentExplorerState: Array<FolderState>
function toggleExplorer(this: HTMLElement) {
  const nearestExplorer = this.closest(".explorer") as HTMLElement
  if (!nearestExplorer) return
  const explorerCollapsed = nearestExplorer.classList.toggle("collapsed")
  nearestExplorer.setAttribute(
    "aria-expanded",
    nearestExplorer.getAttribute("aria-expanded") === "true" ? "false" : "true",
  )

  if (!explorerCollapsed) {
    // Stop <html> from being scrollable when mobile explorer is open
    document.documentElement.classList.add("mobile-no-scroll")
  } else {
    document.documentElement.classList.remove("mobile-no-scroll")
  }
}

// 箭头方向跟随树状态:有任一文件夹打开(含部分打开)→ 箭头朝上,提示"点击=全折叠";
// 全部折叠 → 箭头朝下,提示"点击=全展开"。单个文件夹开合时也要调用保持同步。
function updateFoldChevron(explorer: HTMLElement) {
  const anyOpen = [...explorer.querySelectorAll(".folder-outer")].some((el) =>
    el.classList.contains("open"),
  )
  explorer.classList.toggle("any-open", anyOpen)
}

// 桌面端"探索"旁的箭头:一键展开/折叠所有目录(原上游行为是收起整个探索区,
// 桌面端没什么用,移动端抽屉另有汉堡按钮,故改造)。
// 有任一文件夹打开(含部分打开)时点击=全折叠;全部折叠时点击=全展开。
function toggleAllFolders(this: HTMLElement) {
  const explorer = this.closest(".explorer") as HTMLElement | null
  if (!explorer) return
  const folderOuters = [...explorer.querySelectorAll(".folder-outer")]
  const expandAll = folderOuters.every((el) => !el.classList.contains("open"))
  for (const outer of folderOuters) {
    outer.classList.toggle("open", expandAll)
  }
  updateFoldChevron(explorer)
  this.setAttribute("aria-expanded", expandAll ? "true" : "false")

  // 全量同步状态并落盘,保证换页/刷新后保持
  for (const state of currentExplorerState) {
    state.collapsed = !expandAll
  }
  localStorage.setItem("fileTree", JSON.stringify(currentExplorerState))
}

function toggleFolder(evt: MouseEvent) {
  evt.stopPropagation()
  const target = evt.target as MaybeHTMLElement
  if (!target) return

  // Check if target was svg icon or button
  const isSvg = target.nodeName === "svg"

  // corresponding <ul> element relative to clicked button/folder
  const folderContainer = (
    isSvg
      ? // svg -> div.folder-container
        target.parentElement
      : // button.folder-button -> div -> div.folder-container
        target.parentElement?.parentElement
  ) as MaybeHTMLElement
  if (!folderContainer) return
  const childFolderContainer = folderContainer.nextElementSibling as MaybeHTMLElement
  if (!childFolderContainer) return

  childFolderContainer.classList.toggle("open")

  // Collapse folder container
  const isCollapsed = !childFolderContainer.classList.contains("open")
  setFolderState(childFolderContainer, isCollapsed)

  const currentFolderState = currentExplorerState.find(
    (item) => item.path === folderContainer.dataset.folderpath,
  )
  if (currentFolderState) {
    currentFolderState.collapsed = isCollapsed
  } else {
    currentExplorerState.push({
      path: folderContainer.dataset.folderpath as FullSlug,
      collapsed: isCollapsed,
    })
  }

  const stringifiedFileTree = JSON.stringify(currentExplorerState)
  localStorage.setItem("fileTree", stringifiedFileTree)

  // 单个文件夹开合后同步顶部箭头方向
  const explorer = folderContainer.closest(".explorer") as HTMLElement | null
  if (explorer) updateFoldChevron(explorer)
}

function createFileNode(currentSlug: FullSlug, node: FileTrieNode): HTMLLIElement {
  const template = document.getElementById("template-file") as HTMLTemplateElement
  const clone = template.content.cloneNode(true) as DocumentFragment
  const li = clone.querySelector("li") as HTMLLIElement
  const a = li.querySelector("a") as HTMLAnchorElement
  a.href = resolveRelative(currentSlug, node.slug)
  a.dataset.for = node.slug
  a.textContent = node.displayName

  if (currentSlug === node.slug) {
    a.classList.add("active")
  }

  return li
}

function createFolderNode(
  currentSlug: FullSlug,
  node: FileTrieNode,
  opts: ParsedOptions,
): HTMLLIElement {
  const template = document.getElementById("template-folder") as HTMLTemplateElement
  const clone = template.content.cloneNode(true) as DocumentFragment
  const li = clone.querySelector("li") as HTMLLIElement
  const folderContainer = li.querySelector(".folder-container") as HTMLElement
  const titleContainer = folderContainer.querySelector("div") as HTMLElement
  const folderOuter = li.querySelector(".folder-outer") as HTMLElement
  const ul = folderOuter.querySelector("ul") as HTMLUListElement

  const folderPath = node.slug
  folderContainer.dataset.folderpath = folderPath

  if (opts.folderClickBehavior === "link") {
    // Replace button with link for link behavior
    const button = titleContainer.querySelector(".folder-button") as HTMLElement
    const a = document.createElement("a")
    a.href = resolveRelative(currentSlug, folderPath)
    a.dataset.for = folderPath
    a.className = "folder-title"
    a.textContent = node.displayName
    button.replaceWith(a)
  } else {
    const span = titleContainer.querySelector(".folder-title") as HTMLElement
    span.textContent = node.displayName
  }

  // if the saved state is collapsed or the default state is collapsed
  const isCollapsed =
    currentExplorerState.find((item) => item.path === folderPath)?.collapsed ??
    opts.folderDefaultState === "collapsed"

  // if this folder is a prefix of the current path we
  // want to open it anyways
  const simpleFolderPath = simplifySlug(folderPath)
  const folderIsPrefixOfCurrentSlug =
    simpleFolderPath === currentSlug.slice(0, simpleFolderPath.length)

  if (!isCollapsed || folderIsPrefixOfCurrentSlug) {
    folderOuter.classList.add("open")
  }

  for (const child of node.children) {
    const childNode = child.isFolder
      ? createFolderNode(currentSlug, child, opts)
      : createFileNode(currentSlug, child)
    ul.appendChild(childNode)
  }

  return li
}

async function setupExplorer(currentSlug: FullSlug) {
  const allExplorers = document.querySelectorAll("div.explorer") as NodeListOf<HTMLElement>

  for (const explorer of allExplorers) {
    const dataFns = JSON.parse(explorer.dataset.dataFns || "{}")
    const opts: ParsedOptions = {
      folderClickBehavior: (explorer.dataset.behavior || "collapse") as "collapse" | "link",
      folderDefaultState: (explorer.dataset.collapsed || "collapsed") as "collapsed" | "open",
      useSavedState: explorer.dataset.savestate === "true",
      order: dataFns.order || ["filter", "map", "sort"],
      sortFn: new Function("return " + (dataFns.sortFn || "undefined"))(),
      filterFn: new Function("return " + (dataFns.filterFn || "undefined"))(),
      mapFn: new Function("return " + (dataFns.mapFn || "undefined"))(),
    }

    // Get folder state from local storage
    const storageTree = localStorage.getItem("fileTree")
    const serializedExplorerState = storageTree && opts.useSavedState ? JSON.parse(storageTree) : []
    const oldIndex = new Map<string, boolean>(
      serializedExplorerState.map((entry: FolderState) => [entry.path, entry.collapsed]),
    )

    const data = await fetchData
    const entries = [...Object.entries(data)] as [FullSlug, ContentDetails][]
    let trie = FileTrieNode.fromEntries(entries)

    // 中英分树:文件树只显示当前页面语言的那一半,配合 LanguageSwitch 实现整页切换。
    // 英文页把树根切到 en/ 子树——节点 slug 保留完整路径(含 en/ 前缀),链接不受影响;
    // 中文页把顶层 en 文件夹整个滤掉。
    // langPref=en 时即使落在无译文中文页也保持英文树,让 UI 不因语言缺失而闪回中文。
    const langPref = localStorage.getItem("langPref")
    const slugIsEnglish = currentSlug === "en" || currentSlug.startsWith("en/")
    const isEnglish = langPref === "en" || (langPref === null && slugIsEnglish)
    if (isEnglish) {
      const enRoot = trie.children.find((c) => c.isFolder && c.slugSegment === "en")
      if (enRoot) trie = enRoot
    } else {
      trie.children = trie.children.filter((c) => c.slugSegment !== "en")
    }

    // Apply functions in order
    for (const fn of opts.order) {
      switch (fn) {
        case "filter":
          if (opts.filterFn) trie.filter(opts.filterFn)
          break
        case "map":
          if (opts.mapFn) trie.map(opts.mapFn)
          break
        case "sort":
          if (opts.sortFn) trie.sort(opts.sortFn)
          break
      }
    }

    // Get folder paths for state management
    const folderPaths = trie.getFolderPaths()
    currentExplorerState = folderPaths.map((path) => {
      const previousState = oldIndex.get(path)
      return {
        path,
        collapsed:
          previousState === undefined ? opts.folderDefaultState === "collapsed" : previousState,
      }
    })

    const explorerUl = explorer.querySelector(".explorer-ul")
    if (!explorerUl) continue

    // SPA 换页时 micromorph 不一定会清空旧树(explorer-ul 在所有页面共用同一个 id),
    // 这里不清的话新旧两棵树会叠加,表现为"目录显示两份"。只保留 overflow-end 哨兵。
    for (const child of [...explorerUl.children]) {
      if (!child.classList.contains("overflow-end")) child.remove()
    }

    // Create and insert new content
    const fragment = document.createDocumentFragment()
    for (const child of trie.children) {
      const node = child.isFolder
        ? createFolderNode(currentSlug, child, opts)
        : createFileNode(currentSlug, child)

      fragment.appendChild(node)
    }
    explorerUl.insertBefore(fragment, explorerUl.firstChild)

    // restore explorer scrollTop position if it exists
    const scrollTop = sessionStorage.getItem("explorerScrollTop")
    if (scrollTop) {
      explorerUl.scrollTop = parseInt(scrollTop)
    } else {
      // try to scroll to the active element if it exists
      const activeElement = explorerUl.querySelector(".active")
      if (activeElement) {
        // 只滚动树列表自身;scrollIntoView 会把包括主窗口在内的所有可滚祖先
        // 一起滚,换页后正文会被莫名带跑
        const ulRect = explorerUl.getBoundingClientRect()
        const elRect = activeElement.getBoundingClientRect()
        explorerUl.scrollTop += elRect.top - ulRect.top - ulRect.height / 2
      }
    }

    // Set up event handlers
    // 移动端汉堡=开合抽屉(toggleExplorer);桌面端箭头=全展开/全折叠(toggleAllFolders)
    const explorerButtons = explorer.getElementsByClassName(
      "explorer-toggle",
    ) as HTMLCollectionOf<HTMLElement>
    for (const button of explorerButtons) {
      const handler = button.dataset.mobile === "true" ? toggleExplorer : toggleAllFolders
      button.addEventListener("click", handler)
      window.addCleanup(() => button.removeEventListener("click", handler))
    }

    // 初始箭头方向与当前树状态一致
    updateFoldChevron(explorer)

    // Set up folder click handlers
    if (opts.folderClickBehavior === "collapse") {
      const folderButtons = explorer.getElementsByClassName(
        "folder-button",
      ) as HTMLCollectionOf<HTMLElement>
      for (const button of folderButtons) {
        button.addEventListener("click", toggleFolder)
        window.addCleanup(() => button.removeEventListener("click", toggleFolder))
      }
    }

    const folderIcons = explorer.getElementsByClassName(
      "folder-icon",
    ) as HTMLCollectionOf<HTMLElement>
    for (const icon of folderIcons) {
      icon.addEventListener("click", toggleFolder)
      window.addCleanup(() => icon.removeEventListener("click", toggleFolder))
    }

    // "hover 即聚焦":滚轮悬停在左侧栏时,垂直滚动一律喂给目录,并阻止外溢
    // 滚动正文。目录容器不可滚(内容不超高)时,Chrome 的滚轮黏附会跳过它
    // 直接滚页面,纯 CSS(overscroll-behavior)拦不住,只能 JS 接管。
    // - 桌面端:喂给树列表 explorer-ul;
    // - 移动端(≤800)抽屉打开时:喂给抽屉 explorer-content(触摸滑动走原生
    //   路径不受影响,这里只兜住触控板/鼠标滚轮);抽屉关着时不拦,页面正常滚。
    const sidebar = explorer.closest(".sidebar.left") as HTMLElement | null
    if (sidebar) {
      const ul = explorerUl as HTMLElement
      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey) return // 捏合缩放不拦
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
        // 搜索弹层在侧栏 DOM 内,里面的滚动(结果列表/预览)不劫持
        if ((e.target as HTMLElement).closest(".search-container")) return
        let scroller = ul
        if (window.matchMedia("(max-width: 800px)").matches) {
          if (explorer.classList.contains("collapsed")) return
          scroller = explorer.querySelector(".explorer-content") as HTMLElement
          if (!scroller) return
        }
        e.preventDefault()
        scroller.scrollTop += e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY
      }
      sidebar.addEventListener("wheel", onWheel, { passive: false })
      window.addCleanup(() => sidebar.removeEventListener("wheel", onWheel))
    }
  }
}

document.addEventListener("prenav", async () => {
  // save explorer scrollTop position
  const explorer = document.querySelector(".explorer-ul")
  if (!explorer) return
  sessionStorage.setItem("explorerScrollTop", explorer.scrollTop.toString())
})

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  await setupExplorer(currentSlug)

  // if mobile hamburger is visible, collapse by default
  for (const explorer of document.getElementsByClassName("explorer")) {
    const mobileExplorer = explorer.querySelector(".mobile-explorer")
    if (!mobileExplorer) return

    if (mobileExplorer.checkVisibility()) {
      explorer.classList.add("collapsed")
      explorer.setAttribute("aria-expanded", "false")

      // Allow <html> to be scrollable when mobile explorer is collapsed
      document.documentElement.classList.remove("mobile-no-scroll")
    }

    mobileExplorer.classList.remove("hide-until-loaded")
  }
})

window.addEventListener("resize", function () {
  // Desktop explorer opens by default, and it stays open when the window is resized
  // to mobile screen size. Applies `no-scroll` to <html> in this edge case.
  const explorer = document.querySelector(".explorer")
  if (explorer && !explorer.classList.contains("collapsed")) {
    document.documentElement.classList.add("mobile-no-scroll")
    return
  }
})

function setFolderState(folderElement: HTMLElement, collapsed: boolean) {
  return collapsed ? folderElement.classList.remove("open") : folderElement.classList.add("open")
}

// ── 移动端顶栏:滚动后给 body 打状态类 ──────────────────────────
// 纯 CSS 的 sticky 只能钉住整个 .sidebar.left(标题行+搜索行),做不到
// "只钉标题行"。这里维护 body.header-scrolled,custom.scss 据此在小屏
// 滚动后收起搜索行。nav 后(SPA 换页会重置滚动位置/body 属性)重算一次。
// 收起/展开用两条拉开的阈值(迟滞):搜索行收起会让页面变矮 ~44px,
// 滚动锚定随之回调 scrollY,单一阈值会在临界点来回横跳造成闪烁。
function updateHeaderScrolled() {
  const y = window.scrollY
  const cl = document.body.classList
  if (y > 96) cl.add("header-scrolled")
  else if (y < 16) cl.remove("header-scrolled")
}
window.addEventListener("scroll", updateHeaderScrolled, { passive: true })
document.addEventListener("nav", () => updateHeaderScrolled())
