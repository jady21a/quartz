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

## 当前进度(2026-08-06)

> **站上的订阅入口现在回到 Buttondown**,自建这套是「建好但没接线」的状态,不承接真实读者。
>
> 起因:`quartz/static/subscribe.js` 原来只按 class 认表单、无视 action,四个订阅表单(含
> 「1.Why Z」页那个 action 还写着 Buttondown 的)全被劫持到 `/api/subscribe`。而自建链路
> 缺 AWS 凭证 + SES 沙箱,发不出确认信 —— 读者一律看到「提交失败」。等于 Buttondown 已经
> 下线、自建又没接通,是最坏的中间态。8-6 把 `subscribe.js` 改成只接管同源 action,两个
> index.md 的 action 改回 Buttondown embed。
>
> **切回自建的条件**(全部满足再动,别提前):
> 1. 下面「未完成」1–4 项做完,SES 拿到生产放行;
> 2. 用自己的邮箱把「订阅 → 确认 → 群发 → 退订」完整走通一遍;
> 3. 从 Buttondown 导出订阅者 CSV 灌进 D1,存量按 `confirmed` 导入(他们本来就是主动订阅的,
>    不该再要求二次确认);
> 4. 最后才把 `content/index.md`、`content/en/index.md`、`content/1.Why Z/index.md` 及其
>    英文版这**四个**表单的 action 一起改成 `/api/subscribe` —— 上次就是漏了后两个才发现
>    劫持问题的。
>
> D1 里那行 `jad***@gmail.com` 是 8-5 的自测,`last_confirm_sent_at` 为 null(说明发信失败
> 时的冷却回滚生效了)。切换前顺手删掉即可。

**已完成**

- SES 域名身份 `news.jz21.eu.org` 已验证(区域 `ap-southeast-1`)。Easy DKIM / RSA_2048 和 Custom MAIL FROM `bounce.news.jz21.eu.org` 两项状态都是「成功」。
- Cloudflare DNS 已加齐 6 条:3 条 DKIM CNAME、MAIL FROM 的 MX + SPF、DMARC(`_dmarc.news`,`p=none`)。全部灰云。
- SES 配置集 `newsletter` + 事件目的地 `bounce-complaint-to-sns` → SNS topic `newsletter-events`,只推 Hard bounces 和 Complaints。
- 四个 Pages Functions 端点已部署上线(`/api/subscribe`、`/api/confirm`、`/api/unsubscribe`、`/api/ses-webhook`)。
- D1 库 `newsletter` 已建(`8ccbff33-…`),`subscribers` / `seen_entries` / `sent` 三张表都在。
  注意 `wrangler d1 list` 的 `num_tables` 是滞后统计,显示 0 不代表表没建,以 `sqlite_master` 为准。
- Pages 已有 `NEWSLETTER_SECRET`、`SES_WEBHOOK_TOKEN`;Worker 已有 `NEWSLETTER_SECRET`、`ADMIN_TOKEN`。
  三把都已备份进 Keychain(服务名 `quartz-newsletter`),指纹分别是 `332d34ef` / `495e9ca1` / `bd265afd`。
  两侧的 `NEWSLETTER_SECRET` 是同一份 —— 灌进去时取自同一个值,且 Keychain 里那份指纹一致,可随时复核。
- **Pages 的 D1 绑定和环境变量改由仓库根目录的 `wrangler.toml` 提供**,不再走后台面板。
  Worker 已部署(`newsletter`),cron `*/15` 在跑,`[observability]` 已打开。
- 首次接管(上线步骤 6)**已经做完**:定时任务跑到 bootstrap 分支,20 篇存量文章全标记为已见、一封没发。
  当时名单是 0 人,是做这件事最安全的时刻。
- 运维入口改成了自有域 `https://newsletter.jz21.eu.org`,`?action=status` 实测通(返回 0 人、待发队列空)。

**未完成 —— 按这个顺序做**

装配密钥一律走 `scripts/bootstrap-newsletter.sh`(见下方「一条命令装配密钥」),别再手工复制粘贴。

1. **AWS 的 access key 还没建**,所以两侧都缺 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`,发信必然失败。这是整条链上唯一必须人去控制台点的一步:建只给 `ses:SendEmail` + `ses:SendRawEmail` 的 IAM 用户 → 下载 CSV → `scripts/bootstrap-newsletter.sh --aws-csv ~/Downloads/xxx_accessKeys.csv`。
2. **Pages 改完 secret 必须重新部署才生效**。项目是 git 连接的,推一次仓库就会重建。Worker 侧不用管,写 secret 本身就会生成新版本。
   根目录 `wrangler.toml` 里的 D1 绑定同样要等这次重建才生效 —— 在那之前 `/api/subscribe` 仍然拿不到 `env.DB`。
3. SNS 的 HTTPS 订阅还没建。得等 `SES_WEBHOOK_TOKEN` 在 Pages 里随新部署生效之后,否则 SNS 的确认请求会撞 403、卡在 Pending。本机装了 aws CLI 的话脚本会顺手建掉。
4. **SES 还在沙箱里,这是「读者订阅不了」的最后一道关**。沙箱只允许发给已验证的地址,所以哪怕上面全做完,陌生读者提交后那封确认信照样发不出去、他看到的还是报错页。
   生产放行申请已提交,AWS 回了「需要补充信息」并开了支持工单 `178585586500019`,待回复。回复前最好先让退信回调真正跑通,这样材料能写成完成时。
   在放行之前想验证整条链路:把自己的 QQ/163/Gmail 各加一个 verified identity,用这些地址走一遍订阅→确认→群发→退订。

## 一条命令装配密钥

```bash
scripts/bootstrap-newsletter.sh --dry-run   # 先看它打算做什么
scripts/bootstrap-newsletter.sh
```

它做四件事:补齐 D1 表结构、生成缺的密钥、把两侧该有的分别灌进去、有 aws CLI 就顺手建 SNS 订阅。

为什么不手填:`NEWSLETTER_SECRET` 要在 Pages 和 Worker 两边**完全一致**,而「两边不一致」只有一个成因 —— 人用眼睛和剪贴板搬运。在脚本里它是同一个 shell 变量,不可能不一致。

几条值得知道的设计:

- **Keychain(服务名 `quartz-newsletter`)是唯一权威副本**,重复执行会复用已有的值,不会每跑一次换一把。Cloudflare 的 secret 只写不可读,不留这份备份就等于把 `NEWSLETTER_SECRET` 焊死在云端 —— 而它一旦丢失,除了全量重置(废掉所有已发出的退订链接)没有别的出路。
- **密钥不打印、不落盘、不进 shell 历史**。屏幕上只有 sha256 前 8 位,用来核对推上去的是哪一份;`secret bulk` 从 stdin 读,中间不产生临时文件。
- **名单里已有确认订阅者时,拒绝重新生成 `NEWSLETTER_SECRET`**,要覆盖得显式加 `--force-rotate`。这道闸门挡的正是「顺手重跑一下脚本,结果读者集体退不掉订」。
- AWS 凭证按 Keychain → `--aws-csv` → 本机 aws CLI 的顺序取。走 CSV 那条路时,值从文件直接进 Keychain,不经过屏幕和剪贴板。

跑完还要**推一次仓库触发 Pages 重新部署** —— Pages 的 secret 改动只对新部署生效,这步脚本代劳不了。

## 上线步骤

下面是手工版,留作原理参考和脚本出问题时的兜底。按顺序做,每步都能单独验证。

### 1. AWS SES

1. 建 AWS 账号,进 SES 控制台,区域选一个。**实际用的是 `ap-southeast-1`(新加坡)**,下面的示例值都按它写。
   区域一旦选定别再改:沙箱状态、域名验证、生产放行申请全部按区域独立,换区等于整套重做。
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

> **现在这一步已经不用点后台了** —— 绑定和变量都写在仓库根目录的 `wrangler.toml` 里,推一次仓库就生效。
> 而且**只要那个文件存在,后台面板里手填的绑定和变量就会被忽略**,两边不一致时永远是文件赢。
> 下面这份后台操作留作对照:它列的字段和 `wrangler.toml` 里应该一一对应。
> secret 是唯一的例外,不能进仓库,仍然走 `scripts/bootstrap-newsletter.sh`。

Cloudflare 后台 → Pages 项目 → Settings：

- **Bindings → D1**:变量名 `DB` → 选 `newsletter` 库
- **Environment variables**(生产环境):
  - `SITE_URL` = `https://jz21.eu.org`
  - `AWS_REGION` = `ap-southeast-1`
  - `SES_CONFIGURATION_SET` = `newsletter`
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

**这一步 2026-08-05 已经做完了**,由第一次 cron 触发完成:20 篇全部标记为已见、一封没发。当时名单 0 人,是最安全的时机。库里现在 `seen_entries` 有 20 行且 `broadcast_at` 全非空,不需要再来一次。

先演练,确认收件人名单符合预期(下面的 `<入口>` 见「日常运维」):

```bash
curl "<入口>/?token=<ADMIN_TOKEN>&action=dry-run"
curl "<入口>/?token=<ADMIN_TOKEN>&action=status"
```

## 日常运维

入口是 **`https://newsletter.jz21.eu.org`**(Worker 的 custom domain,`wrangler deploy` 自己建的橙云记录)。所有动作都要带 `?token=<ADMIN_TOKEN>`:

```bash
T=$(security find-generic-password -s quartz-newsletter -a ADMIN_TOKEN -w)
curl "https://newsletter.jz21.eu.org/?token=$T&action=status"
```

**别改回 workers.dev** —— `*.jadyzhang21.workers.dev` 整个返回 1101,见坑那一节。`workers_dev` 已经在 `wrangler.toml` 里设成 `false`,就是为了不让 deploy 再打印那个骗人的地址。

| 目的 | 命令 |
|------|------|
| 看订阅者分布和待发队列 | `?action=status` |
| 演练(不写库不发信) | `?action=dry-run` |
| 立刻跑一次真实群发 | `?action=run` |
| 把当前 feed 全标记为已见(不发信) | `?action=bootstrap` |
| 看日志 | `npx wrangler tail newsletter` |
| 绕开入口看名单 | `npx wrangler d1 execute newsletter --remote --command "SELECT status, COUNT(*) FROM subscribers GROUP BY status"` |

## 几个已经踩过的坑,别再踩回去

**首次跑会不会把存货全轰出去** — 不会,bootstrap 分支挡着。但如果你手动清空过 `seen_entries` 又不小心留了订阅者,下一轮就是真的群发。清库前先 `?action=dry-run`。

**熔断触发了怎么办** — 一轮出现超过 3 篇新文章会中止并告警,九成是 slug 改了导致老文章的 guid 变了、被当成新文。确认之后用 `?action=bootstrap` 收编(不发信),别直接调大 `MAX_NEW_ENTRIES`。

**为什么不是发得越快越好** — 免费版 Workers 单次调用最多 50 个 subrequest,所以 `MAX_SENDS_PER_RUN` 默认 35,没发完的下一轮续。升到 Workers Paid(1000 subrequest)后可以调到 800。

**改了旧文章会不会重发** — 不会。feed 的排序和 guid 都用创建时间与 slug,改内容不影响;而且 `sent` 表按 (人, 文章) 建了主键。

**控制台里几个一点就错的地方** — 都实际踩过:
- SES 的 **MAIL FROM 输入框只要子域前缀**(填 `bounce`,界面自动补 `.news.jz21.eu.org`),填全名会变成 `bounce.news.jz21.eu.org.news.jz21.eu.org`。
- 建 SNS topic 时**类型默认是 FIFO,必须改成 Standard** —— FIFO 只支持 SQS 订阅,给不了 HTTPS。
- 建 SNS 订阅时 **`Enable raw message delivery` 不能勾**。勾了会剥掉 SNS 信封,`ses-webhook.js` 靠 `body.Type === "SubscriptionConfirmation"` 自动确认订阅,信封没了这步直接失效。
- 用 Cloudflare 的 **Import 导入 BIND 文件时,「代理已导入的 DNS 记录」不能勾**,否则 DKIM 的 CNAME 会被套上橙云、SES 永远验证不过。这个方式比手填 6 次表稳,名字也不会被重复拼接。
- SES 建 identity 时那两个 **「Publish DNS records to Route53」默认是勾上的**,DNS 在 Cloudflare 的话取消掉,免得以后看着困惑。

**运维入口返回 `error code: 1101`** — 不是这个 Worker 的 bug,是 `*.jadyzhang21.workers.dev` 这个子域**整个坏了**。判定方法:部署一个只有 `return new Response("ok")` 的空 Worker 上去,它一样 1101。既然连不可能抛异常的代码都 1101,问题就不在代码里。

排查时容易被两件事带偏:

- `wrangler tail` 对这些请求**一条日志都没有**。请求没进到脚本里就被边缘挡掉了,所以「tail 是空的」本身就是证据,不是 tail 坏了。
- 本机 `dig` 出来的是 `198.18.0.x`。那是 Clash/Surge 的 fake-IP 段,不是 Cloudflare 的真实 anycast 地址 —— 说明流量被本地代理接管了。但这只是干扰项:换到本机之外去请求,一样 1101。

反过来,这几项都证明代码和绑定是好的:`wrangler dev --remote`(真·生产运行时)返回 403 正常;cron 的 `scheduled` 一直跑得通,bootstrap 就是它完成的。`workers_dev = true` 和账号子域在 API 里也都显示正常,靠查配置查不出来。

出路是给 Worker 挂自有域路由,`wrangler.toml` 里那句注释「该账号未开子域时可以改成自有域路由」说的就是这个。顺带一提,这个账号挂着博客主域,按 `cf-proxy` 那条规矩本来就不该在上面跑代理类 Worker —— 子域被停用是不是这么来的没证据,但值得记一笔。

**确认信没发出去时冷却戳要退回** — `requestSubscribe` 是「先盖 `last_confirm_sent_at`、再发信」的顺序。发信失败若不回滚,这个人 5 分钟内重试会命中冷却、`shouldSend=false`,前端照样显示「确认信已发出」而其实一封都没发。`subscribe.js` 在发信失败分支调 `clearConfirmCooldown` 补掉了这个洞;冷却本来是防刷的,别让它挡住唯一一个真想订阅的人。

**双重确认能不能关掉** — 技术上能,但别关。名单自持之后,退信和投诉全记在自己的发信域上,没有确认环节等于让任何人往你的名单里塞别人的邮箱。

## 想换掉 SES

只改 `shared/mailer.js` 一个文件,对外只暴露 `sendMail(env, {to, subject, html, text, headers})`。注意新服务商要支持自定义 `List-Unsubscribe` 头,否则 Gmail 的一键退订会失效。

Brevo 免费档 300 封/天(邮件带它的 logo),Resend 免费档 3000 封/月**但限 100 封/天** —— 订阅过百的话一次群发就超,得上 $20/月档。
