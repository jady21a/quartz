// 发信层。目前实现是 Amazon SES v2,但对外只暴露 sendMail() 一个函数 ——
// 以后想换 Brevo / Resend / Postmark,只改这个文件,上层(订阅确认、群发)不用动。
//
// 两个设计决定:
//
// 1. 为什么手搓 SigV4 而不用 aws-sdk:Workers 里塞 SDK 体积太大、冷启动慢,
//    而我们只用一个接口。SigV4 就一百行,一次写对以后不用碰。
//
// 2. 为什么用 Raw(自己拼 MIME)而不用 SES 的 Simple 内容:
//    Simple 模式发不了自定义头,而 List-Unsubscribe + List-Unsubscribe-Post 是
//    Gmail/Yahoo 对批量发件人的硬性要求(RFC 8058 一键退订),没有它直接影响进箱率。
//    自己拼 MIME 顺带还能精确控制 multipart/alternative 的纯文本版。

const encoder = new TextEncoder()

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(text)))
}

async function hmac(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data)))
}

// kSigning = HMAC(HMAC(HMAC(HMAC("AWS4"+secret, date), region), service), "aws4_request")
async function signingKey(secret, date, region, service) {
  let key = encoder.encode("AWS4" + secret)
  for (const part of [date, region, service, "aws4_request"]) {
    key = await hmac(key, part)
  }
  return key
}

function bytesToBase64(bytes) {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function utf8ToBase64(text) {
  return bytesToBase64(encoder.encode(text))
}

// RFC 2045 要求 base64 正文每行不超过 76 字符
function wrapBase64(b64) {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64
}

// 中文主题必须走 RFC 2047 encoded-word,否则收件端看到乱码
function encodeHeaderValue(text) {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(text)) return text
  return `=?UTF-8?B?${utf8ToBase64(text)}?=`
}

function formatAddress(email, name) {
  return name ? `${encodeHeaderValue(name)} <${email}>` : email
}

/**
 * 拼一封 multipart/alternative 的 MIME 原文。
 * 正文一律 base64 编码 —— 中文内容用 quoted-printable 又长又容易在软换行上出错。
 */
function buildMime({ from, fromName, to, subject, html, text, headers = {} }) {
  const boundary = `--=_WhyZ_${crypto.randomUUID()}`
  const lines = [
    `From: ${formatAddress(from, fromName)}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderValue(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
  ]
  for (const [name, value] of Object.entries(headers)) {
    if (value) lines.push(`${name}: ${value}`)
  }
  lines.push(
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrapBase64(utf8ToBase64(text)),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrapBase64(utf8ToBase64(html)),
    ``,
    `--${boundary}--`,
    ``,
  )
  return lines.join("\r\n")
}

/**
 * 发一封信。成功 → { ok: true, messageId }
 * 失败 → { ok: false, status, error, permanent }
 * permanent=true 表示是这个地址本身的问题(格式非法 / 被 SES 压制),重试没意义。
 *
 * env 需要:AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION /
 *          NEWSLETTER_FROM / NEWSLETTER_FROM_NAME(可选)/ SES_CONFIGURATION_SET(可选)
 */
export async function sendMail(env, { to, subject, html, text, headers }) {
  const region = env.AWS_REGION || "us-east-1"
  const service = "ses"
  const host = `email.${region}.amazonaws.com`
  const path = "/v2/email/outbound-emails"

  const raw = buildMime({
    from: env.NEWSLETTER_FROM,
    fromName: env.NEWSLETTER_FROM_NAME || "Why Z",
    to,
    subject,
    html,
    text,
    headers,
  })

  const payload = JSON.stringify({
    Content: { Raw: { Data: bytesToBase64(encoder.encode(raw)) } },
    Destination: { ToAddresses: [to] },
    ...(env.SES_CONFIGURATION_SET ? { ConfigurationSetName: env.SES_CONFIGURATION_SET } : {}),
  })

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "") // 20260803T162400Z
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = await sha256Hex(payload)

  // --- SigV4:1. 规范请求 ---
  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date"
  const canonicalRequest = ["POST", path, "", canonicalHeaders, signedHeaders, payloadHash].join(
    "\n",
  )

  // --- 2. 待签字符串 ---
  const scope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join(
    "\n",
  )

  // --- 3. 签名 ---
  const key = await signingKey(env.AWS_SECRET_ACCESS_KEY, dateStamp, region, service)
  const signature = toHex(await hmac(key, stringToSign))

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${env.AWS_ACCESS_KEY_ID}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  let res
  try {
    res = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        authorization,
      },
      body: payload,
    })
  } catch (err) {
    return { ok: false, status: 0, error: String(err), permanent: false }
  }

  if (res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: true, messageId: body.MessageId }
  }

  const errText = await res.text().catch(() => "")
  // 400/403 里除了限流之外都是这封信自身的问题(地址非法、被压制、身份未验证),重试无用
  const permanent = res.status === 400 && !/Throttl|Rate|TooManyRequests/i.test(errText)
  return { ok: false, status: res.status, error: errText.slice(0, 500), permanent }
}
