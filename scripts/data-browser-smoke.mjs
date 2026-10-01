import { mkdtemp, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createApplication } from '../server/app.mjs'
import { configuration } from '../server/config.mjs'
import { serveStatic } from '../server/static.mjs'
const directory = await mkdtemp(join(tmpdir(), 'moonsprite-data-browser-'))
const config = configuration({ DATA_DIR: directory })
const app = createApplication(config, { serveAsset: serveStatic('dist') })
let browser
try {
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${app.server.address().port}`; config.publicOrigin = base
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.addInitScript(() => localStorage.setItem('moonsprite-language', 'zh'))
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  const response = await page.request.post(base + '/api/auth/register', { headers: { 'X-MoonSprite-Client': 'web' }, data: { name: '数据管理员', email: 'data-admin@example.com', password: 'browser-test-password' } })
  assert.equal(response.status(), 201)
  const account = await response.json()
  app.store.db.prepare('UPDATE accounts SET data=? WHERE id=?').run(JSON.stringify({ ...account, roles: ['admin'] }), account.id)
  for (let i = 0; i < 30; i++) app.store.put('ticket', { id: `ticket-${i}`, subject: `资源下载问题 ${i}`, message: `完整问题描述 ${i}\n第二行内容`, reply: i % 2 ? '已回复' : '', status: i % 2 ? 'answered' : 'open', createdAt: Date.now() + i }, account.id)
  await page.goto(base + '/?features=open#/admin')
  await page.locator('.workspace-nav a[href="#/admin/data"]').click()
  await page.getByRole('heading', { name: '数据浏览', exact: true }).waitFor()
  await page.getByText('data-admin@example.com', { exact: true }).last().waitFor()
  await page.getByRole('button', { name: '数据分类', exact: true }).click()
  await page.getByRole('option', { name: /工单/ }).click()
  await page.getByText('共 30 条 · 第 1 / 2 页 · 每页 25 条', { exact: true }).waitFor()
  assert.equal(await page.locator('.data-browser-table tbody tr').count(), 25)
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await page.getByText('共 30 条 · 第 2 / 2 页 · 每页 25 条', { exact: true }).waitFor()
  assert.equal(await page.locator('.data-browser-table tbody tr').count(), 5)
  await page.getByPlaceholder('昵称、邮箱、商品名称或编号').fill('ticket-29')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await page.getByText('共 1 条 · 第 1 / 1 页 · 每页 25 条', { exact: true }).waitFor()
  await page.getByRole('button', { name: '查看详情', exact: true }).click()
  await page.locator('.data-browser-detail').waitFor()
  assert.ok((await page.locator('.data-browser-detail').innerText()).includes('第二行内容'))
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await page.getByText('共 30 条 · 第 1 / 2 页 · 每页 25 条', { exact: true }).waitFor()
  await page.getByRole('button', { name: '状态筛选', exact: true }).click()
  await page.getByRole('option', { name: /待回复/ }).click()
  await page.getByText('共 15 条 · 第 1 / 1 页 · 每页 25 条', { exact: true }).waitFor()
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  await page.getByText('共 15 条 · 第 1 / 1 页 · 每页 25 条', { exact: true }).waitFor()
  const screenshots = resolve('.tmp-verify-dist/data-browser'); await mkdir(screenshots, { recursive: true })
  await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.activeElement?.blur() })
  await page.screenshot({ path: join(screenshots, 'desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'table scrolls within the page')
  await page.screenshot({ path: join(screenshots, 'mobile.png'), fullPage: true })
  await page.getByPlaceholder('昵称、邮箱、商品名称或编号').fill('no-matches')
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await page.getByText('没有匹配的数据', { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: admin navigation, table, pagination, search, status filter, record details, refresh, empty state and mobile layout.')
} finally { await browser?.close(); await app.close(); console.log('Isolated test data:', directory) }
