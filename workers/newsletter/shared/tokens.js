// 确认订阅 / 退订链接里的签名 token。
//
// 为什么不用自增 ID 或明文邮箱当参数:那样任何人都能枚举 /unsubscribe?id=123 把别人退掉,
// 或者伪造 /confirm?email=xxx 把别人的邮箱塞进名单(list bombing)。
// 这里用 HMAC-SHA256 签名:内容公开可读,但没有 NEWSLETTER_SECRET 就伪造不出有效签名。
//
// token 形如 <base64url(payload)>.<base64url(hmac)>,payload 里:
//   e = email、p = 用途(confirm / unsubscribe)、x = 过期时间戳(0 表示不过期)
// p 字段是必要的:否则一个确认链接能被拿来当退订链接用。

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToB64url(bytes) {
  let binary = ""
  // 分块,避免超长数组把 String.fromCharCode 的参数栈撑爆
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlToBytes(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

/**
 * @param {string} secret  NEWSLETTER_SECRET
 * @param {string} email
 * @param {"confirm"|"unsubscribe"} purpose
 * @param {number} ttlSeconds  只有恰好为 0 才是永不过期(退订链接就该永久有效);
 *                             负数会签出一个已过期的 token —— 宁可签出个用不了的,
 *                             也不能因为算错了 TTL 就悄悄发出一个永久有效的确认链接
 */
export async function signToken(secret, email, purpose, ttlSeconds = 0) {
  const payload = {
    e: email,
    p: purpose,
    x: ttlSeconds === 0 ? 0 : Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = bytesToB64url(encoder.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body))
  return `${body}.${bytesToB64url(new Uint8Array(sig))}`
}

/**
 * 验签 + 校验用途 + 校验过期。返回 email,失败返回 null。
 * 用 crypto.subtle.verify 而不是字符串比较 —— 后者会泄漏时序信息。
 */
export async function verifyToken(secret, token, expectedPurpose) {
  if (typeof token !== "string" || !token.includes(".")) return null
  const [body, sig] = token.split(".", 2)
  if (!body || !sig) return null

  let ok = false
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      b64urlToBytes(sig),
      encoder.encode(body),
    )
  } catch {
    return null
  }
  if (!ok) return null

  let payload
  try {
    payload = JSON.parse(decoder.decode(b64urlToBytes(body)))
  } catch {
    return null
  }

  if (payload.p !== expectedPurpose) return null
  if (payload.x && payload.x < Math.floor(Date.now() / 1000)) return null
  if (typeof payload.e !== "string" || !payload.e) return null
  return payload.e
}
