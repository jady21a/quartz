// @ts-ignore
import nextVideoPollScript from "./scripts/nextVideoPoll.inline"
import styles from "./styles/nextVideoPoll.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

// 视频页底部的「下一期想看哪个」投票框。
// SSR 只出一个隐藏的空壳:题目和选项都由 busuanzi Worker 的 /poll 下发(换一轮只改 Worker,
// 博客不用重建);Worker 挂了 / 当前没有投票,壳子就一直隐藏,页面上什么都不出现。
// 后端见 workers/busuanzi/src/index.js 的 handlePoll。
const NextVideoPoll: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
  return <section class={classNames(displayClass, "next-video-poll")} hidden></section>
}

NextVideoPoll.afterDOMLoaded = nextVideoPollScript
NextVideoPoll.css = styles

export default (() => NextVideoPoll) satisfies QuartzComponentConstructor
