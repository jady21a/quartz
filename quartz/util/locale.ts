import { ValidLocale } from "../i18n"
import { FullSlug } from "./path"

// 英文镜像页(slug 为 "en" 或以 "en/" 开头)用 en-US 渲染界面文案与日期，
// 其余页沿用站点默认 locale。集中判断，避免各组件散落 slug 前缀逻辑。
export function localeForSlug(slug: FullSlug | undefined, fallback: ValidLocale): ValidLocale {
  return slug === "en" || slug?.startsWith("en/") ? "en-US" : fallback
}
