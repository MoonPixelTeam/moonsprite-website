import { mkdtemp, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createApplication } from '../server/app.mjs'
import { configuration } from '../server/config.mjs'
import { serveStatic } from '../server/static.mjs'

// Isolated backend and browser profile: never sends requests to production.
const directory = await mkdtemp(join(tmpdir(), 'moonsprite-wizard-'))
const config = configuration({ DATA_DIR: directory })
const mails = []
const app = createApplication(config, { sendMail: async mail => mails.push(mail), serveAsset: serveStatic('dist') })
let browser
try {
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${app.server.address().port}`
  config.publicOrigin = base
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } })
  await page.addInitScript(() => localStorage.setItem('moonsprite-language', 'zh'))
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.request.post(base + '/api/auth/register/code', { headers: { 'X-MoonSprite-Client': 'web' }, data: { email: 'wizard@example.com' } })
  const registration = await page.request.post(base + '/api/auth/register', { headers: { 'X-MoonSprite-Client': 'web' }, data: { code: mails.at(-1).text.match(/\d{6}/)[0], name: '测试商家', email: 'wizard@example.com', password: 'wizard-test-password' } })
  assert.equal(registration.status(), 201)
  const account = await registration.json()
  app.store.db.prepare('UPDATE accounts SET data=? WHERE id=?').run(JSON.stringify({ ...account, roles: ['buyer', 'creator'] }), account.id)
  await page.goto(base + '/?features=open#/studio/publish')
  await page.getByRole('heading', { name: '上传资源', exact: true }).waitFor()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '请补充' }).waitFor()
  const pet = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 32
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#2979ff'; ctx.fillRect(4, 4, 8, 8); ctx.fillRect(4, 20, 8, 8)
    const binary = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), char => char.charCodeAt(0))
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('MoonSpritePetKey-v1-20260926-123'), 'AES-GCM', false, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, binary))
    return JSON.stringify({ format: 'moonsprite-pet', version: 1, pet: { name: '测试小猫', frameWidth: 16, frameHeight: 16, frameCount: 2, durations: [100, 200], animations: { IDLE: [0, 1], DRAG: [1, 0] }, triggerSlots: [{ id: 'DRAG', event: 'pet.drag-start', repeat: false }] }, spriteEncrypted: { algorithm: 'AES-GCM', iv: btoa(String.fromCharCode(...iv)), data: btoa(String.fromCharCode(...data)) } })
  })
  const file = process.env.WIZARD_PET_FILE ? { name: 'imported.mspet', buffer: await readFile(process.env.WIZARD_PET_FILE), mimeType: 'application/json' } : { name: 'test-pet.mspet', buffer: Buffer.from(pet), mimeType: 'application/json' }
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByText('已识别宠物名称、尺寸、动画和交互，并生成介绍与内容清单。请核对信息并自行定价。', { exact: true }).waitFor()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  const name = await page.locator('input[maxlength="48"]').inputValue()
  assert.ok(name.length >= 2)
  await page.getByPlaceholder('输入价格，免费填 0').fill('0')
  await page.getByLabel('添加英文版（可选）').check()
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.locator('input[maxlength="48"]').fill('Test pet')
  await page.getByRole('button', { name: '中文', exact: true }).click()
  assert.equal(await page.locator('input[maxlength="48"]').inputValue(), name)
  await page.getByText('草稿已保存到此浏览器', { exact: true }).waitFor()
  await page.reload()
  await page.getByText('已恢复上次的草稿和文件，可以继续填写。', { exact: true }).waitFor()
  assert.equal(await page.locator('input[maxlength="48"]').inputValue(), name)
  assert.equal(await page.getByPlaceholder('输入价格，免费填 0').inputValue(), '0')
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  assert.equal(await page.locator('textarea').count(), 1)
  const screenshots = resolve('.tmp-verify-dist/publish-wizard'); await mkdir(screenshots, { recursive: true })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; window.scrollTo({ top: 0, behavior: 'instant' }); (document.activeElement)?.blur() })
  await page.screenshot({ path: join(screenshots, 'desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; window.scrollTo({ top: 0, behavior: 'instant' }) })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await page.screenshot({ path: join(screenshots, 'mobile-light.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('heading', { name: '确认提交', exact: true }).waitFor()
  assert.equal((await (await page.request.get(base + '/api/studio/products')).json()).length, 0, 'Next must never submit the listing')
  await page.getByRole('button', { name: '打开商品详情预览', exact: true }).click()
  await page.waitForURL(/#\/studio\/preview\/new$/)
  await page.locator('.market-detail-page').waitFor()
  assert.equal(await page.locator('.workspace-sidebar').count(), 0)
  assert.equal(await page.locator('main').count(), 1)
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await page.getByRole('heading', { name: 'Test pet', exact: true }).waitFor()
  await page.getByRole('link', { name: '返回编辑', exact: true }).click()
  await page.getByRole('button', { name: '提交审核', exact: true }).waitFor()
  await page.getByRole('button', { name: '提交审核', exact: true }).click()
  await page.waitForURL(/#\/studio\/products$/)
  const products = await (await page.request.get(base + '/api/studio/products')).json()
  assert.equal(products.length, 1)
  assert.equal(products[0].name.en, 'Test pet')
  assert.equal(products[0].price, 0)
  assert.ok(products[0].animations.triggers.length > 0)
  assert.ok(products[0].animations.idle.durations.length > 0)
  const metadata = await (await page.request.get(base + '/api/files/' + products[0].id)).json()
  assert.equal(metadata.name, file.name)
  assert.equal(metadata.size, file.buffer.length)
  await page.goto(base + '/?features=open#/studio/publish')
  await page.getByRole('heading', { name: '上传资源', exact: true }).waitFor()
  assert.equal(await page.getByText('已恢复上次的草稿和文件，可以继续填写。', { exact: true }).count(), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: encrypted pet import, optional English, free price, draft + file restoration, independent preview, submission and cleanup. Screenshots:', screenshots)
} finally { await browser?.close(); await app.close(); console.log('Isolated test data:', directory) }
