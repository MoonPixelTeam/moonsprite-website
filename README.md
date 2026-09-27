# MoonSprite 官网

MoonSprite 官网的独立仓库。桌面版应用在另一个仓库 `moonsprite` 中，本仓库不包含编辑器源码；两者只在“在线体验”（`/try/`）和产品配图上协作，且都由本仓库按需指向应用仓库。

## 环境

```powershell
pnpm install
```

## 常用命令

```powershell
pnpm dev            # 开发服务器，http://localhost:4174
pnpm check          # tsc --noEmit + 样式类名检查 + 像素图标检查
pnpm test           # 三个流程测试（上架、买卖家生命周期、工作区深链）
pnpm build          # tsc --noEmit + vite build，产物在 dist/
pnpm preview        # 预览 dist/
```

`pnpm test` 通过 Vite 的 `ssrLoadModule` 直接加载 `src/` 源码，不需要先构建。

## 与应用仓库协作（可选）

官网默认不依赖应用仓库：不设置 `MOONSPRITE_APP_ROOT` 时，`pnpm dev` / `pnpm build` / `pnpm check` / `pnpm test` 都只处理官网自身。

### 在线体验（/try/）

编辑器是独立进程：在应用仓库执行 `pnpm dev:web-trial` 后它跑在 http://127.0.0.1:5174/try/。官网顶部“在线体验”指向 `SITE_CONFIG.trialUrl`，默认值是 `/try/`（部署后编辑器与官网同源）；开发时用一个环境变量覆盖即可：

```powershell
$env:VITE_TRIAL_URL = "http://127.0.0.1:5174/try/"; pnpm dev
```

两个端口是分开的：官网 4174，编辑器 5174，浏览器直接跨端口打开，不需要把编辑器挂进官网的 dev server。发布时把应用仓库 `pnpm build:web-trial` 的产物 `out/web-trial` 组装到站点 `/try/` 子目录，此时保持默认值即可；必须保留该子目录及其资源，不能把 `/try/` 重写到官网首页。

### 像素图标溯源

图标校验默认只做仓库内自查，需要同时比对桌面版真源时把 `MOONSPRITE_APP_ROOT` 指向应用仓库根目录（例如 `D:\Mine\Study\Work\学习工作\CodexWork\moonsprite`）：`src/assets/icons/` 中的多数像素 SVG 是应用仓库 `PixelUtilityIcon.tsx` / `PlaybackPixelIcon.tsx` 字形的提取副本，`scripts/check-icons.mjs` 会比对哈希与字形路径，防止两边跑偏。没有 `MOONSPRITE_APP_ROOT` 时这部分比对跳过，其余检查照常执行。

## 内部开关：开发中入口

商店、购物车、比赛和账户仍是本地原型，正式站上这四个入口只回答一句「功能开发中，敬请期待」，不会打开对应界面。开关状态按下面的顺序解析，先命中者生效：

| 方式 | 作用范围 | 说明 |
| --- | --- | --- |
| `pnpm dev` | 本地开发服务器 | 默认**放行**，四个入口照常可用，不需要任何设置 |
| `VITE_FEATURES=open pnpm build` | 单次构建产物 | 构建一个不锁的版本 |
| 访问 `?features=open` | 当前浏览器 | 打开一次即记住（写入 localStorage），之后正常访问也保持放行 |
| 浏览器控制台 `localStorage.setItem('moonsprite.features','open')` | 当前浏览器 | 等价于上一条，线上站点同样可用 |

反向开关是 `?features=locked`（或把 localStorage 的值设成 `locked`），用于在开发站上预览上线后的样子。存储键名是 `moonsprite.features`，只影响写入它的那个浏览器，访客看到的仍是开发中提示。

上线前请确认 `pnpm build` 产物是锁定态：打开 preview 后市场入口应弹出提示而不是跳转。

## 部署

站点是纯静态产物（`dist/`），用 hash 路由，不需要服务端或 SPA 回退。推送到 `main` 后由 `.github/workflows/deploy.yml` 自动发布到 GitHub Pages。

工作流做四件事：构建官网、从 `MoonPixelTeam/moonsprite` 拉取源码并构建 web-trial、把产物放进 `dist/try`、上传发布。编辑器与官网因此始终同源，`/try/` 链接使用默认值即可。

### 自定义域名

1. 在仓库 **Settings → Pages → Custom domain** 填入域名。
2. DNS 解析：

   | 域名类型 | 记录 | 值 |
   | --- | --- | --- |
   | 子域名（如 `www.example.com`） | CNAME | `moonpixelteam.github.io` |
   | 根域名（如 `example.com`） | A | `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153` |
   | 根域名（IPv6，可选） | AAAA | `2606:50c0:8000::153`、`2606:50c0:8001::153`、`2606:50c0:8002::153`、`2606:50c0:8003::153` |

3. 解析生效后回到同一页面勾选 **Enforce HTTPS**。

若希望域名由仓库配置驱动（而不是在网页上设置），在 **Settings → Secrets and variables → Actions → Variables** 新建 `PAGES_CUSTOM_DOMAIN`，值是裸域名（不要带 `https://` 或路径）。工作流会据此生成 `CNAME` 文件，与网页端设置等效。

### 中国大陆访问

GitHub Pages 在国内访问不稳定。如果主要面向国内用户，建议把 `dist/` 同步到国内可访问的托管（对象存储 + CDN，需备案）或 Cloudflare Pages；产物完全静态，换托管只需重新上传 `dist/`，不需要改代码。

## 产品配图

`scripts/capture-product.mjs` 用 Playwright 连接应用进程的 WebView2 调试端口截图，写入 `public/assets/product/source/`。需要应用已构建出 `src-tauri/target/release/moonsprite.exe`：

```powershell
pnpm capture:product -- "D:\path\to\moonsprite"
```

## 目录

```text
src/api/          本地原型适配层（localStorage / IndexedDB）
src/pages/        页面与文案副本
src/ui/           组件库（页面不得自拼近似结构）
src/styles/       语义 token 与分区样式；src/styles.css 汇总入口
src/assets/icons/ 像素图标本地副本，provenance.json 记录来源与哈希
scripts/          检查、测试与截图脚本
docs/             界面规范与历史审计记录
res/rec/          功能动图源素材
```

## 约定

- 一切内容都是组件：页面只取数、排版、写文案，控件来自 `src/ui/`。
- 颜色、间距、字号、控件高度只用 `src/styles/foundation.css` 的语义 token，禁止局部写近似 px。
- 容器保持直角与 1px 边框；`#2979FF` 是唯一强调色。
- 图标只用 `src/assets/icons/` 的本地像素 SVG 副本，禁止内联 `<svg>`/`<path>`、字符图标或第三方图标库，`pnpm check` 会拒绝。
- 中英文文案必须成对：`src/pages/*Copy.ts` 与 `src/content.ts` 的两种语言同时补齐。
