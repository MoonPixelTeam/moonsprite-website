/*
 * 从桌面版截图，产出官网的产品配图。官网仓库不再假设自己位于应用仓库里，
 * 所以应用根目录必须显式给出：
 *
 *   pnpm capture:product -- "D:\path\to\moonsprite"
 *   $env:MOONSPRITE_APP_ROOT = "D:\path\to\moonsprite"; pnpm capture:product
 *
 * 需要应用已构建出 src-tauri/target/release/moonsprite.exe。
 */
import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const websiteRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const appRoot = resolve(process.argv[2] ?? process.env.MOONSPRITE_APP_ROOT ?? '')
if (!process.argv[2] && !process.env.MOONSPRITE_APP_ROOT) {
  console.error('[MoonSprite] 请指定应用仓库根目录：pnpm capture:product -- "<moonsprite 路径>"')
  console.error('[MoonSprite] 或设置环境变量 MOONSPRITE_APP_ROOT。')
  process.exit(1)
}

const executable = join(appRoot, 'src-tauri', 'target', 'release', 'moonsprite.exe')
const startupProject = join(appRoot, 'src-tauri', 'resources', '示例.moonsprite')
const outputDirectory = join(websiteRoot, 'public', 'assets', 'product', 'source')
const debugPort = '9231'
const sessionDirectory = await mkdtemp(join(tmpdir(), 'moonsprite-website-capture-'))
const appDataDirectory = join(sessionDirectory, 'app-data')
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

try {
  await Promise.all([access(executable), access(startupProject)])
} catch {
  console.error(`[MoonSprite] 找不到应用构建产物：${executable}`)
  console.error('[MoonSprite] 请先在应用仓库执行桌面版发布构建（pnpm build）。')
  process.exit(1)
}
await mkdir(outputDirectory, { recursive: true })

const child = spawn(executable, [startupProject], {
  detached: false,
  stdio: 'ignore',
  env: {
    ...process.env,
    APPDATA: appDataDirectory,
    LOCALAPPDATA: appDataDirectory,
    WEBVIEW2_USER_DATA_FOLDER: sessionDirectory,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}`,
  },
})

let browser
let page
try {
  const endpoint = `http://127.0.0.1:${debugPort}`
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      browser = await chromium.connectOverCDP(endpoint)
      break
    } catch {
      await delay(250)
    }
  }
  if (!browser) throw new Error('MoonSprite 没有开放 WebView2 调试端口。')

  for (let attempt = 0; attempt < 240; attempt += 1) {
    page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().includes('tauri.localhost'))
    if (page && await page.locator('.document-tab.active').count()) break
    await delay(250)
  }
  if (!page) throw new Error('没有找到 MoonSprite 渲染页。')

  await page.bringToFront()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.locator('canvas.stage-canvas').waitFor({ state: 'visible', timeout: 60_000 })
  await delay(800)

  await page.screenshot({ path: join(outputDirectory, 'workspace.png') })
  await page.locator('.stage-surface').screenshot({ path: join(outputDirectory, 'creation.png') })
  await page.locator('.layers-panel').screenshot({ path: join(outputDirectory, 'animation.png') })

  const layersBox = await page.locator('.layers-panel').boundingBox()
  const paletteBox = await page.locator('.palette-panel').boundingBox()
  if (layersBox && paletteBox) {
    const x = Math.max(0, Math.min(layersBox.x, paletteBox.x) - 12)
    const y = Math.max(0, Math.min(layersBox.y, paletteBox.y) - 12)
    const right = Math.min(1920, Math.max(layersBox.x + layersBox.width, paletteBox.x + paletteBox.width) + 12)
    const bottom = Math.min(1080, Math.max(layersBox.y + layersBox.height, paletteBox.y + paletteBox.height) + 12)
    await page.screenshot({ path: join(outputDirectory, 'layers.png'), clip: { x, y, width: right - x, height: bottom - y } })
  } else {
    await page.locator('.layers-panel').screenshot({ path: join(outputDirectory, 'layers.png') })
  }

  await page.getByRole('button', { name: '导出', exact: true }).click()
  const exportDialog = page.locator('.export-modal')
  await exportDialog.waitFor({ state: 'visible', timeout: 10_000 })
  await page.locator('.export-selected-directory').evaluate((element) => {
    element.textContent = '导出位置：MoonSprite/exports'
    element.removeAttribute('title')
  })
  await exportDialog.screenshot({ path: join(outputDirectory, 'export.png') })
} finally {
  if (page && !page.isClosed()) await page.evaluate(() => window.moonSprite?.approveClose()).catch(() => undefined)
  await browser?.close().catch(() => undefined)
  if (!child.killed) child.kill()
  await rm(sessionDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
}