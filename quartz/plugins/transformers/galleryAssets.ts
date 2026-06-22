import { Root } from "mdast"
import { VFile } from "vfile"
import { QuartzTransformerPlugin } from "../types"

// Flags which optional gallery/video assets a page actually uses, so that Head
// can load the matching scripts/styles only on those pages instead of on every
// page. Detection is based on the raw markdown source (the custom markers are
// authored as raw HTML), so any page that uses them is picked up automatically.
declare module "vfile" {
  interface DataMap {
    usesBookGallery: boolean
    usesMovieGallery: boolean
    usesVideoQuery: boolean
    usesImageQuery: boolean
    usesVideoPlayer: boolean
  }
}

export const GalleryAssets: QuartzTransformerPlugin = () => ({
  name: "GalleryAssets",
  markdownPlugins() {
    return [
      () => (_tree: Root, file: VFile) => {
        const src = file.value?.toString() ?? ""
        file.data.usesBookGallery = src.includes("data-book-query")
        file.data.usesMovieGallery = src.includes("data-movie-query")
        file.data.usesVideoQuery = src.includes("data-video-query")
        file.data.usesImageQuery = src.includes("data-image-query")
        file.data.usesVideoPlayer =
          src.includes("video-player-container") || src.includes("lite-youtube")
      },
    ]
  },
})
