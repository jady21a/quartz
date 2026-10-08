// readStub.js 的类型声明(实现是纯 JS,画廊索引脚本要直接 import)
export declare const READ_STUB_MIN: number
export declare const readFolders: string[]
export declare function measureSubstance(src: string): number
export declare function isReadStub(
  relativePath: string | undefined,
  frontmatter: Record<string, any> | undefined,
  substanceLength: number,
): boolean
