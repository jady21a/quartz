// 首页订阅表单(content/index.md 与 content/en/index.md 里的 form.home-subscribe)的前端逻辑。
//
// 表单的 action 就是 /api/subscribe(见 functions/api/subscribe.js):禁用 JS 时直接 POST 过去,
// 服务端会回一个落地页;本脚本接管后改成 fetch 同一个地址,页面不跳转、原地出提示。
//
// 名单自建之后走的是**双重确认**:提交只是发出确认信,读者点了邮件里的链接才算订阅成功。
// (为什么必须这么做,见 functions/api/subscribe.js 顶部的说明。)
// 所以正常路径的文案是 confirm 而不是 done。
//
// SPA 说明:Quartz 是单页导航,DOM 会被整块替换。这里用挂在 document 上的**事件委托**,
// 不需要在每次 nav 后重新绑定,也不会重复绑定。
;(function () {
  "use strict"

  var ENDPOINT = "/api/subscribe"

  var TEXT = {
    zh: {
      sending: "提交中…",
      done: "订阅成功,新文章会直接发到你邮箱。",
      already: "这个邮箱已经在订阅名单里了。",
      confirm: "确认信已发出,去邮箱点一下链接就好(没看到就翻翻垃圾箱)。",
      invalid: "邮箱格式好像不对,再检查一下?",
      failed: "提交失败,稍后再试一次。",
    },
    en: {
      sending: "Submitting…",
      done: "You're subscribed. New posts will land in your inbox.",
      already: "That email is already on the list.",
      confirm: "Almost there — check your inbox (and spam folder) to confirm.",
      invalid: "That doesn't look like a valid email address.",
      failed: "Something went wrong. Please try again later.",
    },
  }

  function lang() {
    // 中英是同一棵树、按 /en 前缀分语言(与 languageswitch 的判断保持一致)
    var p = window.location.pathname
    return p === "/en" || p.indexOf("/en/") === 0 ? TEXT.en : TEXT.zh
  }

  // 状态行由脚本插到表单后面,这样两份 index.md 都不用改。
  function statusEl(form) {
    var el = form.nextElementSibling
    if (!el || !el.classList.contains("home-subscribe-status")) {
      el = document.createElement("p")
      el.className = "home-subscribe-status"
      el.setAttribute("role", "status")
      el.setAttribute("aria-live", "polite")
      form.insertAdjacentElement("afterend", el)
    }
    return el
  }

  function say(form, message, state) {
    var el = statusEl(form)
    el.textContent = message
    el.dataset.state = state
  }

  document.addEventListener("submit", function (event) {
    var form = event.target
    if (!(form instanceof HTMLFormElement) || !form.classList.contains("home-subscribe")) return

    event.preventDefault()

    var t = lang()
    var input = form.querySelector('input[type="email"]')
    var button = form.querySelector("button")
    var email = input ? input.value.trim() : ""
    if (!email) return

    if (button) button.disabled = true
    say(form, t.sending, "pending")

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email }),
    })
      .then(function (res) {
        return res.json().catch(function () {
          return { ok: res.ok }
        })
      })
      .then(function (data) {
        if (!data.ok) {
          say(form, data.reason === "invalid_email" ? t.invalid : t.failed, "error")
          return
        }
        if (input) input.value = ""
        say(form, data.already ? t.already : data.needsConfirm ? t.confirm : t.done, "success")
      })
      .catch(function () {
        say(form, t.failed, "error")
      })
      .then(function () {
        if (button) button.disabled = false
      })
  })
})()
