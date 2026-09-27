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
