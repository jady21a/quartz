#!/usr/bin/env bash
#
# 邮件订阅的密钥装配。把「生成密钥 → 灌进 Pages → 灌进 Worker → 建 SNS 订阅」
# 压成一条命令。
#
# 为什么要有这个脚本:NEWSLETTER_SECRET 必须在 Pages 和 Worker 两边完全一致,
# 不一致的后果是退订链接验签失败、读者退不掉。而「两边不一致」只有一个成因 ——
# 人用眼睛和剪贴板搬运。在这里它是同一个 shell 变量,不可能不一致。
#
# 三条设计约束:
#   1. 自己生成的密钥不打印到屏幕、不写进文件、不进 shell 历史。屏幕上只出现
#      sha256 前 8 位,用来事后核对「推上去的是不是这一份」。
#   2. Keychain 是唯一权威副本。重复执行复用已有的值,不会每跑一次换一把。
#      这很重要:NEWSLETTER_SECRET 一旦换掉,**已经发出去**的邮件里的退订链接
#      集体失效,所以它必须能被找回,而不是只活在 Cloudflare 的只写存储里。
#   3. 名单里已有确认订阅者时,脚本拒绝重新生成 NEWSLETTER_SECRET,
#      除非显式 --force-rotate。
#
# 用法:
#   scripts/bootstrap-newsletter.sh --dry-run
#   scripts/bootstrap-newsletter.sh
#   scripts/bootstrap-newsletter.sh --aws-csv ~/Downloads/xxx_accessKeys.csv
#   scripts/bootstrap-newsletter.sh --force-rotate      # 明知会废掉旧退订链接
#
# written for macOS 自带的 bash 3.2:没有关联数组、没有 mapfile。
#
set -euo pipefail

PAGES_PROJECT="jz-quartz"
WORKER_NAME="newsletter"
D1_NAME="newsletter"
KEYCHAIN_SERVICE="quartz-newsletter"
SITE_URL="https://jz21.eu.org"
AWS_REGION="ap-southeast-1"
SNS_TOPIC_NAME="newsletter-events"
IAM_USER="newsletter-ses"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$REPO_ROOT/workers/newsletter"

DRY_RUN=0
FORCE_ROTATE=0
AWS_CSV=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)      DRY_RUN=1 ;;
    --force-rotate) FORCE_ROTATE=1 ;;
    --aws-csv)      AWS_CSV="${2:?--aws-csv 后面要跟文件路径}"; shift ;;
    -h|--help)      sed -n '2,29p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)              echo "不认识的参数:$1" >&2; exit 2 ;;
  esac
  shift
done

# ---------- 基础工具 ----------

c_ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
c_info() { printf '\033[36m·\033[0m %s\n' "$*"; }
c_warn() { printf '\033[33m!\033[0m %s\n' "$*" >&2; }
c_die()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

wr() { npx --yes wrangler "$@"; }

# wrangler 会把代理警告混进 stdout,只取第一个 [ 或 { 之后的内容才是 JSON
json_only() { sed -n '/^[[{]/,$p'; }

# printf 是 bash 内建,不 fork,密钥不会出现在任何进程的 argv 里;jq 从管道读
json_escape() { printf '%s' "$1" | jq -Rs .; }

# 只暴露指纹,不暴露值
fingerprint() { printf '%s' "$1" | shasum -a 256 | cut -c1-8; }

# bash 3.2 没有关联数组,用变量名间接引用代替。
# eval 右侧写成 \$2 而不是内插值本身,密钥不会被二次解析。
sec_set() { eval "SEC_$1=\$2"; }
sec_get() { local _r="SEC_$1"; printf '%s' "${!_r-}"; }
sec_has() { local _r="SEC_$1"; [ -n "${!_r-}" ]; }
org_set() { eval "ORG_$1=\$2"; }
org_get() { local _r="ORG_$1"; printf '%s' "${!_r-}"; }

# ---------- Keychain ----------
#
# 首次读取时 macOS 会弹窗要求授权,点「始终允许」之后不再打扰。
# 这里刻意不加 -A(任何程序都能无声读取),多一次点击换一道真实的防线。
# 已知取舍:值经由 security 的 argv 传递,同机同用户可见;单人 Mac 上可接受,
# 换不掉是因为 add-generic-password 除了交互式提问没有别的入口。

kc_get() { security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$1" -w 2>/dev/null; }

kc_put() {
  if [ "$DRY_RUN" = 1 ]; then return 0; fi
  security add-generic-password -U -s "$KEYCHAIN_SERVICE" -a "$1" -w "$2" \
    -l "$KEYCHAIN_SERVICE ($1)" \
    -j "quartz 邮件订阅;由 scripts/bootstrap-newsletter.sh 写入"
}

# 有就复用,没有就新生成
ensure_secret() {
  local name="$1" v
  if v="$(kc_get "$name")" && [ -n "$v" ]; then
    sec_set "$name" "$v"; org_set "$name" "keychain"
  else
    v="$(openssl rand -hex 32)"
    sec_set "$name" "$v"; org_set "$name" "new"
  fi
}

# ---------- 组装并推送 ----------

build_json() {
  local first=1 out="{" k
  for k in "$@"; do
    sec_has "$k" || continue
    [ "$first" = 1 ] || out="$out,"
    first=0
    out="$out$(json_escape "$k"):$(json_escape "$(sec_get "$k")")"
  done
  printf '%s}' "$out"
}

# 两个 bulk 子命令省略文件参数时都从 stdin 读(已实测),所以密钥不落盘
push_pages() {
  if [ "$DRY_RUN" = 1 ]; then c_info "[dry-run] 会灌进 Pages($PAGES_PROJECT):$*"; return 0; fi
  build_json "$@" | ( cd "$REPO_ROOT" && wr pages secret bulk --project-name "$PAGES_PROJECT" ) >/dev/null
  c_ok "Pages($PAGES_PROJECT)已更新:$*"
}

push_worker() {
  if [ "$DRY_RUN" = 1 ]; then c_info "[dry-run] 会灌进 Worker($WORKER_NAME):$*"; return 0; fi
  build_json "$@" | ( cd "$WORKER_DIR" && wr secret bulk --name "$WORKER_NAME" ) >/dev/null
  c_ok "Worker($WORKER_NAME)已更新:$*"
}

aws_ready() { command -v aws >/dev/null 2>&1 && aws sts get-caller-identity >/dev/null 2>&1; }

# ---------- 0. 前置检查 ----------

for bin in jq openssl shasum security python3; do
  command -v "$bin" >/dev/null 2>&1 || c_die "缺少 $bin"
done
[ -f "$WORKER_DIR/schema.sql" ] || c_die "找不到 $WORKER_DIR/schema.sql,仓库结构变了?"

if [ "$DRY_RUN" = 1 ]; then c_warn "dry-run:只说要做什么,不改任何线上状态"; fi

# ---------- 1. D1 表结构 ----------
# schema.sql 全是 CREATE ... IF NOT EXISTS,重复跑没有副作用

if [ "$DRY_RUN" = 1 ]; then
  c_info "[dry-run] 会执行 schema.sql(幂等)"
else
  ( cd "$REPO_ROOT" && wr d1 execute "$D1_NAME" --remote --yes --file="$WORKER_DIR/schema.sql" ) >/dev/null
  c_ok "D1($D1_NAME)表结构已就位"
fi

# ---------- 2. 现有订阅者 → 决定能不能重新生成密钥 ----------

confirmed=0
raw="$( ( cd "$REPO_ROOT" && wr d1 execute "$D1_NAME" --remote --json \
        --command "SELECT COUNT(*) AS n FROM subscribers WHERE status='confirmed'" ) 2>/dev/null | json_only )" || raw=""
if [ -n "$raw" ]; then
  confirmed="$(printf '%s' "$raw" | jq -r '.[0].results[0].n // 0' 2>/dev/null || echo 0)"
fi
c_info "名单里已确认的订阅者:$confirmed 人"

# ---------- 3. 自己生成的三把密钥 ----------

ensure_secret NEWSLETTER_SECRET
ensure_secret SES_WEBHOOK_TOKEN
ensure_secret ADMIN_TOKEN

# 唯一的危险动作:换掉一把线上正在用的 NEWSLETTER_SECRET。
# 只有「Keychain 里没备份」才会走到重新生成,而那时线上大概率已经有一把了。
if [ "$(org_get NEWSLETTER_SECRET)" = "new" ] && [ "$confirmed" -gt 0 ] && [ "$FORCE_ROTATE" = 0 ]; then
  c_die "Keychain 里没有 NEWSLETTER_SECRET 的备份,但名单里已有 $confirmed 位确认订阅者。
    重新生成会让已发出邮件里的退订链接全部失效 —— 这是最招投诉的坏法。
    确实要换就加 --force-rotate,并且接受「下一封邮件发出前,老链接都是坏的」。"
fi

for k in NEWSLETTER_SECRET SES_WEBHOOK_TOKEN ADMIN_TOKEN; do
  c_info "$k  来源=$(org_get "$k")  指纹=$(fingerprint "$(sec_get "$k")")"
  if [ "$(org_get "$k")" = "new" ]; then kc_put "$k" "$(sec_get "$k")"; fi
done
if [ "$DRY_RUN" != 1 ]; then c_ok "不可重新生成的值已备份进 Keychain(服务名 $KEYCHAIN_SERVICE)"; fi

# ---------- 4. AWS 凭证 ----------
# 整条链上唯一无法完全自动化的一环:key 由 AWS 签发,总得有个人类起点。
# 优先级:Keychain → 控制台下载的 CSV → 本机已登录的 aws CLI 现开。

if v="$(kc_get AWS_ACCESS_KEY_ID)" && [ -n "$v" ]; then
  sec_set AWS_ACCESS_KEY_ID "$v"
  sec_set AWS_SECRET_ACCESS_KEY "$(kc_get AWS_SECRET_ACCESS_KEY)"
  c_info "AWS 凭证取自 Keychain(key id 指纹=$(fingerprint "$v"))"

elif [ -n "$AWS_CSV" ]; then
  [ -f "$AWS_CSV" ] || c_die "找不到 $AWS_CSV"
  # 按表头取值:AWS 前后改过几次列名和列序,按位置取迟早翻车
  _csv="$(python3 - "$AWS_CSV" <<'PY'
import csv, sys
with open(sys.argv[1], newline="", encoding="utf-8-sig") as f:
    row = next(csv.DictReader(f))
cols = {k.strip().lower(): (v or "").strip() for k, v in row.items()}
print(cols.get("access key id", ""))
print(cols.get("secret access key", ""))
PY
)"
  _id="$(printf '%s\n' "$_csv" | sed -n 1p)"
  _sk="$(printf '%s\n' "$_csv" | sed -n 2p)"
  unset _csv
  [ -n "$_id" ] && [ -n "$_sk" ] || c_die "从 CSV 里没解析出 access key,列名对不上"
  sec_set AWS_ACCESS_KEY_ID "$_id"; sec_set AWS_SECRET_ACCESS_KEY "$_sk"
  kc_put AWS_ACCESS_KEY_ID "$_id"; kc_put AWS_SECRET_ACCESS_KEY "$_sk"
  unset _id _sk
  c_ok "AWS 凭证已收编进 Keychain。原始 CSV 现在可以删了:rm '$AWS_CSV'"

elif aws_ready; then
  c_info "检测到已登录的 aws CLI,现开一把只能发信的 key"
  if [ "$DRY_RUN" = 1 ]; then
    c_info "[dry-run] 会建 IAM 用户 $IAM_USER(只给 ses:SendEmail/SendRawEmail)并签发 key"
  else
    aws iam create-user --user-name "$IAM_USER" >/dev/null 2>&1 || true
    aws iam put-user-policy --user-name "$IAM_USER" --policy-name ses-send-only \
      --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ses:SendEmail","ses:SendRawEmail"],"Resource":"*"}]}' >/dev/null
    _ak="$(aws iam create-access-key --user-name "$IAM_USER" \
            --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)"
    _id="$(printf '%s' "$_ak" | awk '{print $1}')"
    _sk="$(printf '%s' "$_ak" | awk '{print $2}')"
    unset _ak
    sec_set AWS_ACCESS_KEY_ID "$_id"; sec_set AWS_SECRET_ACCESS_KEY "$_sk"
    kc_put AWS_ACCESS_KEY_ID "$_id"; kc_put AWS_SECRET_ACCESS_KEY "$_sk"
    unset _id _sk
    c_ok "IAM 用户 $IAM_USER 已就位,key 直接进了 Keychain(全程没经过屏幕)"
  fi

else
  c_warn "这轮跳过 AWS 凭证:Keychain 里没有,没给 --aws-csv,本机也没有可用的 aws CLI。
    Cloudflare 两侧的其余密钥照常装配;补上 AWS key 只要再跑一次这个脚本。"
fi

# ---------- 5. 推送 ----------
# 两侧清单不同,但 NEWSLETTER_SECRET 是同一个变量 —— 这正是本脚本存在的理由

push_pages  NEWSLETTER_SECRET SES_WEBHOOK_TOKEN AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
push_worker NEWSLETTER_SECRET ADMIN_TOKEN       AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

# ---------- 6. SNS 订阅 ----------
# ses-webhook.js 自己会处理 SubscriptionConfirmation 并回访 SubscribeURL,
# 所以这里 subscribe 一发就自动确认,不用去控制台点。
# RawMessageDelivery 必须保持关闭(默认关):开了会剥掉 SNS 信封,自动确认失效。

endpoint="$SITE_URL/api/ses-webhook?token=$(sec_get SES_WEBHOOK_TOKEN)"

if aws_ready; then
  topic_arn="$(aws sns list-topics --region "$AWS_REGION" \
    --query "Topics[?ends_with(TopicArn, \`:$SNS_TOPIC_NAME\`)].TopicArn | [0]" \
    --output text 2>/dev/null || echo None)"
  if [ "$topic_arn" = "None" ] || [ -z "$topic_arn" ]; then
    c_warn "SNS 里找不到名为 $SNS_TOPIC_NAME 的 topic,跳过订阅"
  elif aws sns list-subscriptions-by-topic --topic-arn "$topic_arn" --region "$AWS_REGION" \
        --query 'Subscriptions[].Endpoint' --output text 2>/dev/null | grep -qF "$endpoint"; then
    c_ok "SNS 订阅已存在,跳过"
  elif [ "$DRY_RUN" = 1 ]; then
    c_info "[dry-run] 会给 $topic_arn 建一个指向 /api/ses-webhook 的 HTTPS 订阅"
  else
    # 走 --cli-input-json + stdin,别让带 token 的 URL 出现在 argv 里
    EP="$endpoint" jq -n --arg t "$topic_arn" \
      '{TopicArn:$t, Protocol:"https", Endpoint:$ENV.EP, ReturnSubscriptionArn:true}' \
      | aws sns subscribe --region "$AWS_REGION" --cli-input-json file:///dev/stdin >/dev/null
    c_ok "SNS HTTPS 订阅已建立(端点会自行确认)"
  fi
else
  c_warn "没有可用的 aws CLI,SNS 订阅留给你。端点里的 token 用这条取(会弹 Keychain 授权):
    security find-generic-password -s $KEYCHAIN_SERVICE -a SES_WEBHOOK_TOKEN -w"
fi

# ---------- 7. 收尾 ----------

echo
if ! sec_has AWS_ACCESS_KEY_ID; then
  c_warn "还差 AWS 凭证 —— 在这之前发信必然失败。控制台建好只给 ses:SendEmail 的 IAM 用户后:
    scripts/bootstrap-newsletter.sh --aws-csv ~/Downloads/xxx_accessKeys.csv"
fi
cat <<EOF
下一步(Pages 的 secret 改动只对**新部署**生效,这步省不掉):
  Pages 项目 $PAGES_PROJECT 是 git 连接的,推一次仓库就会重建。
  Worker 侧不用管 —— 写 secret 本身就会生成新版本。

部署完验一遍:
  curl -sS -X POST $SITE_URL/api/subscribe -d 'email=你的邮箱@example.com'
EOF
