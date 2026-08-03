// D1 访问层。所有 SQL 都收在这里,上层不拼字符串(全部走 bind 占位符,免注入)。
//
// 订阅者状态机:
//   pending      刚提交,确认邮件已发出,还没点确认 —— 不会收到任何推送
//   confirmed    已确认,正常收信
//   unsubscribed 主动退订
//   bounced      硬退信(地址不存在)。必须立刻停发,否则退信率会拖垮发信域信誉
//   complained   被标记为垃圾邮件。同上,而且更严重,永不重新订阅

// 同一个邮箱两封确认信之间的最小间隔
const CONFIRM_RESEND_COOLDOWN_MINUTES = 5

export async function getSubscriber(db, email) {
  return db
    .prepare(
      "SELECT id, email, status, lang, last_confirm_sent_at FROM subscribers WHERE email = ?",
    )
    .bind(email)
    .first()
}

/**
 * 提交订阅。已存在的处理方式取决于当前状态:
 *   pending      → 重发确认邮件(用户可能没收到),不动记录
 *   confirmed    → 什么都不做,告诉前端"已经在名单里了"
 *   unsubscribed → 允许重新订阅,退回 pending 走一遍确认
 *   bounced/complained → 静默拒绝。投诉过的人再被加回来是找封号
 *
 * 返回 { action, shouldSend }。shouldSend=false 表示冷却期内,
 * 前端照样显示"确认信已发出" —— 不能把限流状态暴露给调用方,
 * 否则这个接口就成了探测某邮箱在不在名单里的工具。
 */
export async function requestSubscribe(db, { email, lang, source }) {
  const existing = await getSubscriber(db, email)

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO subscribers (email, status, lang, source, last_confirm_sent_at)
         VALUES (?, 'pending', ?, ?, datetime('now'))`,
      )
      .bind(email, lang, source ?? null)
      .run()
    return { action: "created", shouldSend: true }
  }

  if (existing.status === "confirmed") return { action: "already", shouldSend: false }
  if (existing.status === "bounced" || existing.status === "complained") {
    return { action: "blocked", shouldSend: false }
  }

  // pending 或 unsubscribed:退回 pending,并(在冷却期外)重发确认信。
  //
  // 这两件事必须分成两条语句。写成一条、把冷却条件挂在同一个 WHERE 上的话,
  // 「退订后 5 分钟内又想订回来」的人会被冷却条件连状态一起挡掉 ——
  // 前端显示"确认信已发出",库里却还是 unsubscribed,点确认链接也救不回来。
  // 状态恢复无条件执行,冷却只管"要不要再发一封信"。
  await db
    .prepare(
      "UPDATE subscribers SET status = 'pending', lang = ?, unsubscribed_at = NULL WHERE email = ?",
    )
    .bind(lang, email)
    .run()

  const res = await db
    .prepare(
      `UPDATE subscribers SET last_confirm_sent_at = datetime('now')
       WHERE email = ?
         AND (last_confirm_sent_at IS NULL
              OR last_confirm_sent_at <= datetime('now', '-${CONFIRM_RESEND_COOLDOWN_MINUTES} minutes'))`,
    )
    .bind(email)
    .run()

  // 冷却期内不重发也没关系:上一封确认信里的 token 还有效,点了照样能确认
  return { action: "resend", shouldSend: (res.meta?.changes ?? 0) > 0 }
}

/**
 * 点确认链接。只允许 pending → confirmed;
 * 已经 confirmed 的重复点击按成功处理(用户可能点了两次)。
 * bounced/complained 不允许被一个旧链接复活。
 */
export async function confirmSubscriber(db, email) {
  const existing = await getSubscriber(db, email)
  if (!existing) return { ok: false, reason: "unknown" }
  if (existing.status === "confirmed") return { ok: true, already: true }
  if (existing.status !== "pending" && existing.status !== "unsubscribed") {
    return { ok: false, reason: "blocked" }
  }
  await db
    .prepare(
      "UPDATE subscribers SET status = 'confirmed', confirmed_at = datetime('now') WHERE email = ?",
    )
    .bind(email)
    .run()
  return { ok: true, already: false }
}

export async function unsubscribe(db, email) {
  const res = await db
    .prepare(
      `UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now')
       WHERE email = ? AND status NOT IN ('bounced', 'complained')`,
    )
    .bind(email)
    .run()
  // 就算没匹配到也回 true:退订页永远显示成功,不给外部探测某邮箱在不在名单里的机会
  return { ok: true, changed: (res.meta?.changes ?? 0) > 0 }
}

/** SES 的退信 / 投诉回调用。这是保命的一步,不接等于慢性自杀。 */
export async function markStatus(db, email, status) {
  await db
    .prepare("UPDATE subscribers SET status = ? WHERE email = ? AND status != 'complained'")
    .bind(status, email)
    .run()
}

export async function countByStatus(db) {
  const { results } = await db
    .prepare("SELECT status, COUNT(*) AS n FROM subscribers GROUP BY status")
    .all()
  return Object.fromEntries((results ?? []).map((r) => [r.status, r.n]))
}

// --- 文章去重 ---

export async function getSeenGuids(db) {
  const { results } = await db.prepare("SELECT guid FROM seen_entries").all()
  return new Set((results ?? []).map((r) => r.guid))
}

/**
 * 记下"见过这条"。broadcast=false 用于**首次接管时的对账**:
 * 把 feed 里已有的历史文章全部标记为已见但不发信,
 * 否则第一次定时任务跑起来会把最近 20 篇一次性轰给所有订阅者。
 */
export async function markSeen(db, entries, { broadcast }) {
  if (!entries.length) return
  const stmt = db.prepare(
    `INSERT INTO seen_entries (guid, title, broadcast_at)
     VALUES (?, ?, ${broadcast ? "datetime('now')" : "NULL"})
     ON CONFLICT(guid) DO NOTHING`,
  )
  await db.batch(entries.map((e) => stmt.bind(e.guid, e.title ?? null)))
}

/** 还没广播完的条目(broadcast_at 为空 = 还在发或还没开始发) */
export async function pendingBroadcasts(db) {
  const { results } = await db
    .prepare(
      "SELECT guid, title FROM seen_entries WHERE broadcast_at IS NULL ORDER BY first_seen_at ASC",
    )
    .all()
  return results ?? []
}

export async function markBroadcastDone(db, guid) {
  await db
    .prepare("UPDATE seen_entries SET broadcast_at = datetime('now') WHERE guid = ?")
    .bind(guid)
    .run()
}

// --- 发送去重 ---

/** 某条文章还没发到的已确认订阅者,最多取 limit 个 */
export async function recipientsFor(db, guid, limit) {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.email, s.lang FROM subscribers s
       WHERE s.status = 'confirmed'
         AND NOT EXISTS (
           SELECT 1 FROM sent WHERE sent.subscriber_id = s.id AND sent.entry_guid = ?
         )
       ORDER BY s.id ASC
       LIMIT ?`,
    )
    .bind(guid, limit)
    .all()
  return results ?? []
}

/** 某条文章还差多少人没发到。演练模式用它报出真实规模(分批发送时只看一个 chunk 会低估) */
export async function countRecipientsFor(db, guid) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM subscribers s
       WHERE s.status = 'confirmed'
         AND NOT EXISTS (
           SELECT 1 FROM sent WHERE sent.subscriber_id = s.id AND sent.entry_guid = ?
         )`,
    )
    .bind(guid)
    .first()
  return row?.n ?? 0
}

/**
 * 记录已发。(subscriber_id, entry_guid) 是主键 —— 这是"绝不重发"的最后一道保险:
 * 就算定时任务重叠执行、或者中途崩了重跑,同一个人同一篇也只会进一条。
 *
 * 注意调用时序:群发是**先记账再发信**。反过来的话,Worker 在发完信、记账前被掐断,
 * 下一轮就会给同一个人再发一遍 —— 对读者来说重复收信比漏收一封刺眼得多(还容易招投诉)。
 * 发信真失败了再把这条记录删掉(deleteSent)让下轮重试。
 */
export async function recordSentBatch(db, subscriberIds, guid) {
  if (!subscriberIds.length) return
  const stmt = db.prepare(
    "INSERT INTO sent (subscriber_id, entry_guid) VALUES (?, ?) ON CONFLICT DO NOTHING",
  )
  await db.batch(subscriberIds.map((id) => stmt.bind(id, guid)))
}

/** 发信临时失败时回滚记账,让下一轮定时任务重试这个人 */
export async function deleteSent(db, subscriberId, guid) {
  await db
    .prepare("DELETE FROM sent WHERE subscriber_id = ? AND entry_guid = ?")
    .bind(subscriberId, guid)
    .run()
}
