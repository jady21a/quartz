import { QuartzFilterPlugin } from "../types"
import { isReadStub } from "../../util/readStub"

// 书影空壳页(只有豆瓣元数据、自己没写几个字)不单独上线。口径见 quartz/util/readStub.js。
// 整页剔除之后 sitemap / RSS / 站内搜索 / 图谱 / 文件夹页都自然不含它;
// 画廊卡片照常显示但不可点(索引脚本读同一口径),别处链向它的地方由
// transformers/readStubLinks.ts 渲染成纯文字。
// 不认 QUARTZ_KEEP_DRAFTS:空壳页本来就没什么可预览的,而画廊索引也不分预览/正式,
// 两边口径一致最省心。
export const RemoveReadStubs: QuartzFilterPlugin<{}> = () => ({
  name: "RemoveReadStubs",
  shouldPublish(_ctx, [_tree, vfile]) {
    return !isReadStub(
      vfile.data.relativePath,
      vfile.data.frontmatter,
      vfile.data.substanceLength ?? 0,
    )
  },
})
