# MoonSprite 后端运行与部署

当前网站使用 Node.js 24 + SQLite 后端。`pnpm dev` 同时启动网站与 API；账户、订单、素材、工单和提现记录落在服务器数据库，不再保存在浏览器。购物车和语言偏好仍留在浏览器。

## 本地启动

```powershell
pnpm install
Copy-Item .env.example .env
pnpm dev
```

打开终端显示的地址，默认 `http://localhost:5173`。原有 BAT 启动器传入的 `127.0.0.1:4174` 也受支持。开发脚本按实际端口确定邮件链接和 Origin 校验地址；API 默认监听 `127.0.0.1:3001`。端口被占用时直接报错，不接管已有进程。

`pnpm start` 启动后端并提供 `dist/` 静态文件，需要先 `pnpm build`。默认界面沿用原来的正式站功能闸门；要部署可用商店，构建前设置 `VITE_FEATURES=open`。仅测试展示页面可以用 `pnpm dev:frontend`。明确设置 `VITE_API_BASE_URL=` 才使用旧的浏览器原型。

## 初始化管理员与商品

没有内置管理员或默认密码。先用你自己的邮箱创建管理员，密码通过环境变量传递：

```powershell
$credential = Get-Credential -UserName '你的管理员邮箱' -Message '设置 MoonSprite 管理员密码（至少 8 位）'
$env:ADMIN_PASSWORD = $credential.GetNetworkCredential().Password
pnpm manage create-admin $credential.UserName
Remove-Item Env:ADMIN_PASSWORD
pnpm seed:catalogue $credential.UserName
```

导入命令会读取现有市场目录，只导入有真实交付文件的商品，绑定该账号为卖家，并复制交付文件进入数据库。没有文件的展示商品跳过；再次执行不覆盖已有商品或记录。预览图保留现有路径，购买文件由受保护端点提供。导入属于自有站点素材的首次发布；后续用户上传走审核流程。

登录后访问 `#/admin` 或 `#/studio`。普通注册用户只有 buyer 角色，管理员可在服务器授予创作者角色：

```powershell
pnpm manage set-role creator@example.com creator
```

支持 `buyer`、`creator`、`admin`。变更角色会撤销该账号现有会话，用户需要重新登录。服务器控制台持有数据库访问权，因此这些命令只交给服务器管理员。

## ZPAY 收款

实现依据：[ZPAY 官方开发文档](https://z-pay.cn/doc.html)，2026-09-30 核对。官方文档的收银台域名是 `https://zpayz.cn/submit.php`，与官网 `z-pay.cn` 不同。

在 `.env` 或服务器环境变量设置：

```dotenv
ZPAY_PID=商户ID
ZPAY_KEY=商户密钥
# 可选：指定支付渠道
ZPAY_CID=
PUBLIC_ORIGIN=https://你的域名
```

这些值不能使用 `VITE_` 前缀，不能写进前端或提交 Git。付款支持支付宝、微信；采用官方推荐的 POST 表单跳转。创建订单只提交商品 ID 和数量，标题、价格、费率由服务器读取。

- 现有商品价格以 USD 记账，沿用网站的固定换算 `1 USD = 7.2 CNY`，不是实时外汇报价。服务端以整数分计算，订单锁定人民币金额和汇率；最终付款前再显示人民币实收金额。
- `https://你的域名/api/payments/zpay/notify` 是异步回调。验签、商户、订单、币种对应金额、支付方式和平台流水校验通过后，在单个数据库事务内生成权益和收入。
- `https://你的域名/api/payments/zpay/return` 只负责跳回购买记录，不将浏览器跳转视为付款证据。
- 回调幂等；重复创建相同待付款购物单返回原订单。未付款不算已购、不可下载、不计销售收入。
- 回调延迟时，订单详情的查询按钮通过服务端向 ZPAY 查单并核对响应；不会自动反复重试或轮询支付平台。
- 没有商户配置时，收费订单返回 `payment-unavailable`，免费领取正常运行。

真实交易尚需商户开通对应渠道、公网 HTTPS 域名能接收回调，并以小额订单验证实际支付。测试使用隔离数据库及模拟签名/查单响应，没有向 ZPAY 发起真实扣款。

## 邮箱验证与找回密码

开发环境未设置 SMTP 时，邮件写入 `server/data/mail/*.json`；打开其中链接即可测试。该目录不会通过网站发布。生产环境必须配置真实 SMTP，不能落回开发邮件箱：

```dotenv
SMTP_URL=smtps://用户名:经过URL编码的密码@smtp.example.com:465
MAIL_FROM=MoonSprite <noreply@example.com>
```

验证码采用随机一次性令牌，只保存令牌摘要，一小时过期。GET 打开邮件链接不会改变账号，需在页面点击确认；重置密码后撤销所有旧会话。修改邮箱会取消验证状态及旧令牌。登录页和账户设置均可发起找回密码。

## 文件与审核

素材文件最大 50 MiB，存放在 SQLite BLOB 中；预览图片支持受限格式、大小和数量。上传字节作为附件提供，不在服务器执行。新建、修改商品或替换文件都会重新进入待审核。替换文件先存入草稿，审核通过后才替换已发布文件；已购用户在此之前仍能下载旧的已审核版本。

下载文件列表、元数据和内容端点分别检查身份与权限。服务器提供附件文件名并禁止内容类型猜测。下架只归档商品，保留已有购买权益；已有权益或待付订单的交付文件不允许直接删除。

构建会排除 `mspet/msext/mspack/zip/7z/rar/lua` 交付文件，开发服务器也拦截这些静态包路径。禁止将仓库根目录或数据库目录配置为 Web 根目录。

## 账本与提现

收入只来自已付款订单，订单保存成交时的平台费率，后续改费率不追溯历史。金额内部用整数分计算，账本接口兼容前端的 USD 数值。

提现按卖家自己的可用余额冻结金额。`requested → approved → paid`，或 `requested/approved → rejected`；终态不可回退。拒绝需要原因，标记 paid 需要实际转账凭据。审批、上传、审核、付款和角色操作均记录审计事件。

提现是人工转账登记流程。ZPAY 文档提供的是收款接口，本实现不冒充自动代付；ZPAY 商户提现与网站给素材卖家的付款也不是同一笔业务。平台费不包含 ZPAY 自身渠道成本。退款目前通过支持工单和商户后台人工处理，未实现自动退款/冲账，发生退款后需人工核对账本再安排卖家结算。

## 正式部署

### GitHub 拉取更新

仓库中的 `scripts/deploy-server.sh` 是服务器更新入口。首次部署完成后，在服务器执行：

```bash
cd /opt/moonsprite-website
MOONSPRITE_DIR=/opt/moonsprite-website bash scripts/deploy-server.sh
```

它会拉取 `origin/main`、锁定依赖、重新构建前端并重启 `moonsprite.service`。不要把 `.env`、`/etc/moonsprite/moonsprite.env` 或 `server/data/` 提交到 GitHub；它们只保留在服务器。服务器需要对仓库有只读 GitHub 访问权（公开仓库可直接拉取，私有仓库使用部署密钥）。

首次安装服务文件：

```bash
sudo install -d -m 750 /etc/moonsprite
sudo install -m 644 deploy/moonsprite.service /etc/systemd/system/moonsprite.service
sudo systemctl daemon-reload
sudo systemctl enable --now moonsprite
```

Nginx 反向代理示例见 `deploy/nginx-moonsprite.conf`。启用 HTTPS 后，把 `PUBLIC_ORIGIN` 改为 `https://moonsprite.art`，并在环境文件中配置真实 `SMTP_URL` 与 `MAIL_FROM`，再重启服务。

使用单台 Node.js 服务和本地持久磁盘，适合初期规模；SQLite 文件不要放共享网络盘。GitHub Pages 只能发布静态介绍页，不能承载本后端。

```powershell
$env:VITE_FEATURES = 'open'
pnpm build
$env:NODE_ENV = 'production'
pnpm start
```

生产要求 `PUBLIC_ORIGIN=https://...`、`SMTP_URL` 和 `MAIL_FROM`；配置缺失时启动失败。`Secure; HttpOnly; SameSite=Lax` 会话 Cookie 有效七天；站点采用同源 `/api`，不开放任意跨域凭据请求。

HTTPS 反向代理将网站和 `/api` 都转发到 Node 的 `127.0.0.1:3001`。Nginx location 示例（证书/server_name 按实际配置）：

```nginx
location / {
    client_max_body_size 51m;
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

这种配置下设置 `TRUST_PROXY=1`，后端仅监听回环地址。公网不能直接访问后端端口，代理必须覆盖 X-Real-IP；否则不能开启信任代理。这样限流按真实客户 IP 计算。

持久化数据目录由 `DATA_DIR` 指定。停止服务后备份整个目录（含数据库、可能存在的 WAL/SHM 文件）；恢复到同路径再启动。不要只在运行中复制单个 SQLite 文件。数据库同时包含原始交付文件和提现账户信息，应限制磁盘访问权限并对备份加密。账号注销移除登录资料、会话和个人工单，归档卖家商品；财务记录保留用于对账，未结余额、待处理提现或待付订单须先处理。保留期限、真实运营主体、隐私披露和交易条款仍需在对外运营前按实际业务更新。

## 验证

```powershell
pnpm test:backend
pnpm test
pnpm check
pnpm build
pnpm test:browser
```

后端测试通过真正的 HTTP 请求验证角色隔离、价格篡改、支付验签/幂等/查单、私有下载、草稿审核、跨账号工单、令牌单次使用、会话撤销、数据库重启持久化和并发提现。它们不替代商户及 SMTP 的真实联调。
`test:browser` 使用临时数据库验证管理员命令、已有商品迁移和真实浏览器注册/目录展示；先运行 build。Windows 使用已安装的 Edge，其他平台需要 Playwright Chromium。

## 本次审查范围

已覆盖前端现有 HTTP 合同：账户、订单、素材目录、创作者工作室、文件、售后、举报、审核、平台费和提现。比赛当前是已结束活动的静态展示，没有报名/提交入口；博客、帮助文档和软件更新链接也仍为静态内容，不额外虚构管理后台。全站加购数尚无事件采集，因此不返回伪造统计。

## 配置 ZPAY 商户信息

服务器运行 `sudo python3 scripts/configure-zpay.py`，按提示输入商户 ID、密钥及可选通道 ID；密钥不会回显或进入命令历史。然后运行 `sudo systemctl restart moonsprite`。工具保留 SMTP 等其它配置。商户后台需要开通支付宝/微信对应渠道；最后用小额订单确认支付、异步回调与下载授权完整成功。

旧账号通过邮件验证码重置密码后会同步标记邮箱已验证；不会批量把未经验证的旧邮箱标记为已验证。免费商品无需 ZPAY 配置，包括领取自己发布的免费素材；付费自购仍被禁止。
