import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createApplication } from '../server/app.mjs'
import { configuration } from '../server/config.mjs'
import { serveStatic } from '../server/static.mjs'

// Run after pnpm build. Uses an isolated database and never contacts a payment provider.
const directory = await mkdtemp(join(tmpdir(), 'moonsprite-smoke-'))
const mails = []
let app, browser
try {
  const env = { ...process.env, NODE_ENV: 'development', DATA_DIR: directory, ADMIN_PASSWORD: randomBytes(24).toString('hex'), ZPAY_PID: '', ZPAY_KEY: '', SMTP_URL: '' }
  for (const args of [['server/manage.mjs', 'create-admin', 'smoke-admin@example.com'], ['scripts/seed-catalogue.mjs', 'smoke-admin@example.com']]) {
    const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr); console.log(result.stdout.trim())
  }
  const config = configuration(env)
  app = createApplication(config, { sendMail: async mail => mails.push(mail), serveAsset: serveStatic('dist') })
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve))
  config.publicOrigin = `http://127.0.0.1:${app.server.address().port}`
  const catalogue = await (await fetch(config.publicOrigin + '/api/catalogue')).json()
  assert.ok(catalogue.length > 0)
  console.log('Imported catalogue available:', catalogue.length)
  const entries = await readdir('dist', { recursive: true })
  assert.ok(entries.every(name => !/\.(mspet|zip|msext|mspack)$/i.test(name)))
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) })
  const page = await browser.newPage()
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(config.publicOrigin + '/?features=open#/register')
  await page.locator('input[autocomplete="name"]').fill('Smoke Buyer')
  await page.locator('input[type="email"]').fill('smoke-buyer@example.com')
  await page.locator('input[type="password"]').fill('Browser-test-password')
  await page.getByRole('button', { name: /获取验证码|Get code/ }).click()
  await page.getByText(/验证码已发送|Code sent/).waitFor()
  await page.locator('input[autocomplete="one-time-code"]').fill(mails.at(-1).text.match(/\d{6}/)[0])
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/#\/account$/)
  await page.locator('#main').getByText('smoke-buyer@example.com', { exact: true }).waitFor()
  const account = await (await page.request.get(config.publicOrigin + '/api/auth/session')).json()
  assert.equal(account.emailVerified, true)
  await page.request.post(config.publicOrigin + '/api/auth/sign-out', { headers: { 'X-MoonSprite-Client': 'web' }, data: {} })
  await page.goto('about:blank')
  await page.goto(config.publicOrigin + '/?features=open#/login')
  await page.getByRole('button', { name: '忘记密码？', exact: true }).click()
  await page.locator('input[type="email"]').fill(account.email)
  await page.getByRole('button', { name: '获取验证码', exact: true }).click()
  await page.getByText('如果该邮箱已注册且邮件投递成功，你将收到验证码，请检查收件箱和垃圾邮件。', { exact: true }).waitFor()
  await page.locator('input[autocomplete="one-time-code"]').fill(mails.at(-1).text.match(/\d{6}/)[0])
  await page.locator('input[type="password"]').fill('Updated-browser-password')
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await page.getByText('密码已重置，请使用新密码重新登录。', { exact: true }).waitFor()
  assert.equal(await (await page.request.get(config.publicOrigin + '/api/auth/session')).json(), null)
  await page.goto(config.publicOrigin + '/?features=open#/market')
  await page.getByText(catalogue[0].name.zh, { exact: true }).first().waitFor()
  assert.deepEqual(errors, [])
  console.log('Browser smoke passed: registration, cookie session, account page and migrated catalogue.')
} finally {
  await browser?.close(); await app?.close()
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('moonsprite-smoke-'))
  await rm(directory, { recursive: true, force: true })
}
