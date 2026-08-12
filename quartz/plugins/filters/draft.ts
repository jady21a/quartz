import { QuartzFilterPlugin } from "../types"

// QUARTZ_KEEP_DRAFTS=1 时草稿也照常构建。用途:视频文章写完但视频还没发(页面必须
// 保持 draft 免得线上出现没有播放源的页面),而录屏时又要展示这一页——本地
// `QUARTZ_KEEP_DRAFTS=1 npx quartz build --serve` 就能看到。quartz-push.sh 不带这个
// 变量,所以线上永远排除草稿;generate-videos.js 读同一个变量,保证索引与构建同进同退。
const keepDrafts = process.env.QUARTZ_KEEP_DRAFTS === "1"

export const RemoveDrafts: QuartzFilterPlugin<{}> = () => ({
  name: "RemoveDrafts",
  shouldPublish(_ctx, [_tree, vfile]) {
    if (keepDrafts) return true
    const draftFlag: boolean =
      vfile.data?.frontmatter?.draft === true || vfile.data?.frontmatter?.draft === "true"
    return !draftFlag
  },
})
