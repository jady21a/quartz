// 旧生产域名 jz-quartz.pages.dev 已迁移到 jz21.eu.org,301 保住旧链接与搜索权重。
// 只精确匹配生产域名;每次构建的预览子域(xxxx.jz-quartz.pages.dev)不跳转,留作预览用。
export async function onRequest(context) {
  const url = new URL(context.request.url)
  if (url.hostname === "jz-quartz.pages.dev") {
    url.hostname = "jz21.eu.org"
    return Response.redirect(url.toString(), 301)
  }
  return context.next()
}
