// 「本周更新」和「数据面板」两个页面的主屏幕图标:node scripts/page-icons/gen.mjs
// 和 reader / Days / Todo 一套:#1C1C1C 底、白图形。正式用的不带签名(2026-11-14 起),写进 quartz/static/icons/;
// 右下带手写 Jz 的那套作为备用,写进 scripts/page-icons/with-jz/(不会发布),要换回去就拷过去覆盖。
// 标签页用的小图标不在这里:它不带签名,直接内联在页面里
// (本周更新在 ~/info-digest/scripts/render.py 的 ICON_DAILY,数据面板在 workers/busuanzi/src/index.js)。改图形两边要一起改。
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
const HERE = new URL('.', import.meta.url).pathname;
const OUT = HERE + '../../quartz/static/icons/', BAK = HERE + 'with-jz/';
mkdirSync(BAK, { recursive: true });
const SIG = 'data:image/png;base64,' + readFileSync(HERE + 'jz-sig.png').toString('base64');
const BG = '#1C1C1C', FG = '#FFFFFF', GOLD = '#C9A56A', GREY = '#8A8A8E';
const glyphs = {
  daily: `<circle cx="156" cy="356" r="40" fill="${GOLD}"/><g fill="none" stroke="${FG}" stroke-width="46" stroke-linecap="round"><path d="M128 226a158 158 0 0 1 158 158"/><path d="M128 120a264 264 0 0 1 264 264"/></g>`,
  panel: `<g fill="none" stroke="${FG}" stroke-linecap="round"><path d="M120 392H392" stroke-width="28"/><path d="M168 320V268M256 320V196" stroke-width="52"/><path d="M344 320V124" stroke="${GREY}" stroke-width="52"/></g>`,
};
const sig = `<mask id="m" style="mask-type:luminance"><image href="${SIG}" x="361.8" y="327.1" width="114.4" height="111.8"/></mask><rect width="512" height="512" fill="${FG}" mask="url(#m)"/>`;
// 带签名时图形缩到 82% 往左上挪,给右下的 Jz 让位;不带时原大居中。k < 1 是「可裁切」版:整体再缩到中间,系统裁圆时切不到。
const full = (g, k = 1, jz = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${BG}"/><g transform="translate(256 256) scale(${k}) translate(-256 -256)">${jz ? `<g transform="translate(-34 -40) translate(256 256) scale(.82) translate(-256 -256)">${g}</g>${sig}` : g}</g></svg>`;
// PNG 都是铺满的不透明方图,圆角交给系统裁。
const b = await chromium.launch();
for (const [name, g] of Object.entries(glyphs)) {
  for (const [suffix, size, k] of [['512', 512, 1], ['192', 192, 1], ['180', 180, 1], ['512-maskable', 512, .78]]) {
    for (const [dir, jz] of [[OUT, false], [BAK, true]]) {
      const p = await b.newPage({ viewport: { width: size, height: size } });
      await p.setContent(`<body style="margin:0">${full(g, k, jz).replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `)}</body>`);
      await p.screenshot({ path: `${dir}${name}-${suffix}.png` });
      await p.close();
    }
  }
}
await b.close();
