-- 邮件订阅的 D1 表结构。
-- 建库并初始化:
--   npx wrangler d1 create newsletter
--   npx wrangler d1 execute newsletter --remote --file=workers/newsletter/schema.sql
-- 本地开发把 --remote 换成 --local。

CREATE TABLE IF NOT EXISTS subscribers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT    NOT NULL UNIQUE,
  -- pending | confirmed | unsubscribed | bounced | complained
  status          TEXT    NOT NULL DEFAULT 'pending',
  lang            TEXT    NOT NULL DEFAULT 'zh',
  source          TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  confirmed_at    TEXT,
  unsubscribed_at TEXT,
  -- 上次发出确认信的时间。用来限流:挡住有人反复拿别人的邮箱刷我们的确认信
  -- (拿我们的发信域给人做邮件轰炸,是自建订阅最容易被白嫖的一个口子)
  last_confirm_sent_at TEXT
);

-- 每次群发都要按 status 捞人
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers (status);

-- feed 里出现过的文章。首次接管时把历史文章全部灌进来但 broadcast_at 留空→再置为已完成,
-- 这样定时任务只会推「接管之后新出现的」,不会把 20 篇存货一次性轰出去。
CREATE TABLE IF NOT EXISTS seen_entries (
  guid          TEXT PRIMARY KEY,
  title         TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- NULL = 还没发完;有值 = 这篇的群发已结束
  broadcast_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_seen_pending ON seen_entries (broadcast_at, first_seen_at);

-- 杂项状态。目前只放两个键:
--   last_webhook_event_at  最后一次真的收到 SES 回调事件(退信/投诉)的时间
--   last_webhook_probe_at  最后一次自测回调端点的时间(用来把自测限成一天一次)
--
-- 为什么要记前者:回调链是整套里唯一能「静默」失效的一环 —— 断了之后信照发、
-- 站点照常,你只是不再知道哪些地址死了,而死地址留在名单里反复投递会把退信率
-- 一路推高,等 SES 找上门已经是警告或停用。这个时间戳是唯一能看出它还活着的仪表。
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- 「谁收到过哪篇」。复合主键是绝不重发的最后一道保险:
-- 定时任务重叠执行、中途崩溃重跑,同一人同一篇也只会有一行。
CREATE TABLE IF NOT EXISTS sent (
  subscriber_id INTEGER NOT NULL,
  entry_guid    TEXT    NOT NULL,
  sent_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (subscriber_id, entry_guid)
);
