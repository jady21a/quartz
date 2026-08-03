# 自建邮件订阅(替代 Buttondown)

名单存在自己的 D1,发信走 SES,只有「把字节递到收件服务器」这一段买现成的。

## 组成

| 位置 | 作用 |
|------|------|
| `quartz/plugins/emitters/newsletterFeed.ts` | 生成 `/newsletter.xml`:全文 + 所有 `src`/`href` 绝对化 |
| `functions/api/subscribe.js`                | 收订阅、写 D1、发确认信 |
| `functions/api/confirm.js`                  | 双重确认落地页 |
| `functions/api/unsubscribe.js`              | 退订(GET 落地页 + POST 一键退订) |
| `functions/api/ses-webhook.js`              | SES 退信/投诉回调 → 停发 |
| `workers/newsletter/src/index.js`           | 定时任务:feed 差分 → 群发 |
| `workers/newsletter/shared/`                | Pages Functions 和 Worker 共用的模块 |
| `workers/newsletter/schema.sql`             | D1 表结构 |

Pages Functions 和 Worker 共用 `shared/` 下的代码,所以 `functions/` 里是 `import ../../workers/newsletter/shared/x.js`。改动只需落在一处。

## 上线步骤

按顺序做,每步都能单独验证。

### 1. AWS SES

1. 建 AWS 账号,进 SES 控制台,区域选一个(下面按 `us-east-1`)。
2. **验证发信域**:Verified identities → Create identity → Domain → 填 `news.jz21.eu.org`,开启 Easy DKIM。SES 会给出 3 条 CNAME,加到 Cloudflare DNS(记录要**关掉小云朵**,DNS only)。
3. 加 SPF:给 `news.jz21.eu.org` 加 TXT 记录 `v=spf1 include:amazonses.com ~all`。
4. 加 DMARC:给 `_dmarc.news.jz21.eu.org` 加 TXT `v=DMARC1; p=none; rua=mailto:你的邮箱`。
5. **申请解除沙箱**:Account dashboard → Request production access。沙箱状态下只能发给已验证的地址,而且限速 1 封/秒。工单一般 1 个工作日内批。
6. 建一个只有 `ses:SendEmail` 权限的 IAM 用户,拿 access key。

> 为什么用子域 `news.` 而不是主域:万一某次群发被大量标记垃圾,烧的是子域信誉,`jz21.eu.org` 和你的个人邮件不受牵连。

### 2. D1

```bash
npx wrangler d1 create newsletter
# 把输出里的 database_id 填进 workers/newsletter/wrangler.toml
npx wrangler d1 execute newsletter --remote --file=workers/newsletter/schema.sql
```

### 3. Pages 项目(订阅/确认/退订三个端点)

Cloudflare 后台 → Pages 项目 → Settings：

- **Bindings → D1**:变量名 `DB` → 选 `newsletter` 库
- **Environment variables**(生产环境):
  - `SITE_URL` = `https://jz21.eu.org`
  - `AWS_REGION` = `us-east-1`
  - `NEWSLETTER_FROM` = `hi@news.jz21.eu.org`
  - `NEWSLETTER_FROM_NAME` = `Why Z`
- **Secrets**(加密变量):
  - `NEWSLETTER_SECRET` — 随便一串长随机值,`openssl rand -hex 32`
  - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
  - `SES_WEBHOOK_TOKEN` — 另一串随机值,给退信回调用

### 4. 群发 Worker

```bash
cd workers/newsletter
npx wrangler secret put NEWSLETTER_SECRET      # 必须和 Pages 那边**完全一致**
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY
npx wrangler secret put ADMIN_TOKEN            # 手动运维入口的口令
npx wrangler deploy
```

`NEWSLETTER_SECRET` 两边不一致的后果:群发邮件里的退订链接验签失败,读者点了退不掉 —— 这是会招投诉的那种失败。

顺手把 `wrangler.toml` 里的 `ADMIN_EMAIL` 填上,熔断和 feed 异常会发到这个地址。

### 5. 退信/投诉回调

SES 控制台 → Configuration sets → 建一个(比如 `newsletter`),加 Event destination：
- 事件类型勾 **Bounce** 和 **Complaint**
- 目的地选 SNS topic(新建一个)
- 给该 SNS topic 加 HTTPS 订阅,端点填：
  `https://jz21.eu.org/api/ses-webhook?token=<SES_WEBHOOK_TOKEN>`

SNS 会先发一条确认消息,端点会自动完成订阅(见 `ses-webhook.js`)。

最后把配置集名字填进 `wrangler.toml` 的 `SES_CONFIGURATION_SET`,重新 deploy。

> 这一步别跳过。不接回调,死地址会永远留在名单里反复投递,退信率一路走高,SES 对此的处理是先警告后停用账号。

### 6. 首次接管

部署完**第一次**跑,`seen_entries` 是空的,Worker 会走 bootstrap 分支:把 feed 里现有的 20 篇全部标记为「已见」但**一封不发**,之后只推新发布的文章。

先演练,确认收件人名单符合预期:

```bash
curl "https://newsletter.<你的子域>.workers.dev/?token=<ADMIN_TOKEN>&action=dry-run"
curl "https://newsletter.<你的子域>.workers.dev/?token=<ADMIN_TOKEN>&action=status"
```

## 日常运维

| 目的 | 命令 |
|------|------|
| 看订阅者分布和待发队列 | `?action=status` |
| 演练(不写库不发信) | `?action=dry-run` |
| 立刻跑一次真实群发 | `?action=run` |
| 把当前 feed 全标记为已见(不发信) | `?action=bootstrap` |
| 看日志 | `npx wrangler tail newsletter` |

## 几个已经踩过的坑,别再踩回去

**首次跑会不会把存货全轰出去** — 不会,bootstrap 分支挡着。但如果你手动清空过 `seen_entries` 又不小心留了订阅者,下一轮就是真的群发。清库前先 `?action=dry-run`。

**熔断触发了怎么办** — 一轮出现超过 3 篇新文章会中止并告警,九成是 slug 改了导致老文章的 guid 变了、被当成新文。确认之后用 `?action=bootstrap` 收编(不发信),别直接调大 `MAX_NEW_ENTRIES`。

**为什么不是发得越快越好** — 免费版 Workers 单次调用最多 50 个 subrequest,所以 `MAX_SENDS_PER_RUN` 默认 35,没发完的下一轮续。升到 Workers Paid(1000 subrequest)后可以调到 800。

**改了旧文章会不会重发** — 不会。feed 的排序和 guid 都用创建时间与 slug,改内容不影响;而且 `sent` 表按 (人, 文章) 建了主键。

**双重确认能不能关掉** — 技术上能,但别关。名单自持之后,退信和投诉全记在自己的发信域上,没有确认环节等于让任何人往你的名单里塞别人的邮箱。

## 想换掉 SES

只改 `shared/mailer.js` 一个文件,对外只暴露 `sendMail(env, {to, subject, html, text, headers})`。注意新服务商要支持自定义 `List-Unsubscribe` 头,否则 Gmail 的一键退订会失效。

Brevo 免费档 300 封/天(邮件带它的 logo),Resend 免费档 3000 封/月**但限 100 封/天** —— 订阅过百的话一次群发就超,得上 $20/月档。
