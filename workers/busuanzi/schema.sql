-- busuanzi 计数器的 D1 表结构。
--
-- 为什么从 KV 换过来:KV 免费档一天只有 1000 次写,而一次页面访问要写 3~7 次
-- (site_pv / page_pv / d_pv,新访客再加 uv 那几条),天花板约 300 PV/天 ——
-- 2026-08-24 收到 Cloudflare 的 50% 告警时,日常已经在 45%~70% 之间晃。
-- D1 免费档是 10 万行写/天,同样的写法天花板变成两万 PV/天。
--
-- 顺带修掉的老毛病:KV 的 incr() 是「读出来、加一、写回去」,并发下会丢。
-- 迁移当天对过账:site_pv 计数器 3529,而 178 个 page_pv 相加是 3624 —— 丢了 95 次
-- (2.7%),因为 site_pv 是所有请求共用的最热 key,撞得最狠。这里所有累加都走
-- `SET n = n + 1` 的原子更新,不会再丢。
--
-- 应用方式:  npx wrangler d1 execute busuanzi --remote --file=schema.sql

-- ── 全站累计数 ───────────────────────────────────────────────────────────
-- 用显式计数器而不是 SUM(pages.pv):迁移时按 KV 里的旧值播种,博客上那两个数字
-- 才不会在切换当天跳一下(上面说的 95 次漂移)。写一行的成本在 D1 这边无所谓。
-- key: site_pv / site_uv / dl:<slug> / dl_uniq:<slug>
CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  n   INTEGER NOT NULL DEFAULT 0
);

-- ── 每页浏览量(面板的 PV 排行) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  path TEXT PRIMARY KEY,
  pv   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pages_pv ON pages(pv DESC);

-- ── 日别桶(站点自有口径:只数带白名单 Origin 的真人请求) ───────────────
-- 永久保存,不清理 —— 面板的日趋势要的就是全部历史。
CREATE TABLE IF NOT EXISTS daily (
  date TEXT PRIMARY KEY,          -- YYYY-MM-DD (UTC)
  pv   INTEGER NOT NULL DEFAULT 0,
  uv   INTEGER NOT NULL DEFAULT 0
);

-- ── 访客去重(加盐后的 IP 哈希,不存明文 IP) ────────────────────────────
-- first_day 决定何时过期(对应 KV 时代 uv_ip 的一年 TTL),**不随每次访问刷新**:
-- 一年前来过的人再来会重新算一个 UV,这是原来的语义,照搬。
-- last_day 取代 KV 的 uvd: 短 TTL 标记,用来判断「这个人今天是不是已经计过日 UV」。
CREATE TABLE IF NOT EXISTS visitors (
  hash      TEXT PRIMARY KEY,
  first_day TEXT NOT NULL,
  last_day  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS visitors_first_day ON visitors(first_day);

-- ── 下载跳转计数(/dl/<slug>,见 worker 里 handleDownload 的注释) ────────
CREATE TABLE IF NOT EXISTS downloads (
  slug TEXT NOT NULL,
  date TEXT NOT NULL,
  n    INTEGER NOT NULL DEFAULT 0,  -- 总次数
  u    INTEGER NOT NULL DEFAULT 0,  -- 独立下载(当天同 IP 只算一次)
  PRIMARY KEY (slug, date)
);

-- 当天下载去重标记。只留两天,cron 清理(对应 KV 的 48 小时 TTL)。
CREATE TABLE IF NOT EXISTS download_ips (
  slug TEXT NOT NULL,
  date TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (slug, date, hash)
);

-- ── Cloudflare 边缘日别快照 ──────────────────────────────────────────────
-- CF 自己只留 ~30 天,这里永久累积。整行 JSON 存(含国家/浏览器/状态码分布),
-- 形状和 KV 时代的 cfd: 值完全一致,面板那边不用改。
CREATE TABLE IF NOT EXISTS cf_daily (
  date TEXT PRIMARY KEY,
  json TEXT NOT NULL
);

-- ── 杂项单值(目前只有本机推上来的平台账号数据 plat:latest) ─────────────
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
