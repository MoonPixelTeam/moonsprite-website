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
let app, browser
try {
  const env = { ...process.env, NODE_ENV: 'development', DATA_DIR: directory, ADMIN_PASSWORD: randomBytes(24).toString('hex'), ZPAY_PID: '', ZPAY_KEY: '', SMTP_URL: '' }
  for (const args of [['server/manage.mjs', 'create-admin', 'smoke-admin@example.com'], ['scripts/seed-catalogue.mjs', 'smoke-admin@example.com']]) {
    const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr); console.log(result.stdout.trim())
  }
  const config = configuration(env)
  app = createApplication(config, { serveAsset: serveStatic('dist') })
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
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(/#\/account$/)
  await page.locator('#main').getByText('smoke-buyer@example.com', { exact: true }).waitFor()
  await page.goto(config.publicOrigin + '/?features=open#/market')
  await page.getByText(catalogue[0].name.zh, { exact: true }).first().waitFor()
  assert.deepEqual(errors, [])
  console.log('Browser smoke passed: registration, cookie session, account page and migrated catalogue.')
} finally {
  await browser?.close(); await app?.close()
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('moonsprite-smoke-'))
  await rm(directory, { recursive: true, force: true })
}
