// @ts-ignore
import scrollButtonsScript from "./scripts/scrollButtons.inline"
import styles from "./styles/scrollButtons.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

// 移动端浮动「回到顶部 / 回到底部」按钮(桌面隐藏,见 scrollButtons.scss)
const ScrollButtons: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return (
    <div class={classNames(displayClass, "scroll-buttons")}>
      <button class="scroll-btn scroll-to-top" aria-label="回到顶部" title="回到顶部">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <button class="scroll-btn scroll-to-bottom" aria-label="回到底部" title="回到底部">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>
  )
}

ScrollButtons.afterDOMLoaded = scrollButtonsScript
ScrollButtons.css = styles

export default (() => ScrollButtons) satisfies QuartzComponentConstructor
