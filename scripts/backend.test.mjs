import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApplication } from '../server/app.mjs'
import { hashToken } from '../server/auth.mjs'
import { configuration } from '../server/config.mjs'
import { signZpay } from '../server/payments.mjs'
import { serveStatic } from '../server/static.mjs'

const password = 'test-password-123'
const productInput = (price = 10) => ({ name: { zh: '测试宠物', en: 'Test pet' }, tagline: { zh: '动画', en: 'Animation' }, body: { zh: '测试交付包', en: 'Test delivery' }, price, category: 'pets', size: '1 pet', formats: ['mspet'], tags: [] })
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'moonsprite-backend-'))
  const messages = []
  const config = { ...configuration({ DATA_DIR: directory }), zpayPid: 'test-merchant', zpayKey: 'private-test-key', ...options }
  let app = createApplication(config, { sendMail: options.sendMail ?? (async mail => messages.push(mail)), queryPayment: options.queryPayment, serveAsset: serveStatic(join(directory, 'dist')) })
  const listen = async () => { await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${app.server.address().port}` }
  let base = await listen()
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }) })
  const client = () => {
    let cookie = ''
    return async (path, method = 'GET', body, extra = {}) => {
      const response = await fetch(base + '/api' + path, { method, redirect: 'manual', headers: { 'X-MoonSprite-Client': 'web', ...(cookie ? { Cookie: cookie } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...extra }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) })
      if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]
      const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text()
      return { status: response.status, data, headers: response.headers }
    }
  }
  const register = async (address, roles) => {
    const call = client()
    assert.equal((await call('/auth/register/code', 'POST', { email: address })).status, 200)
    const code = messages.at(-1).text.match(/\d{6}/)[0]
    const response = await call('/auth/register', 'POST', { code, name: address.split('@')[0], email: address, password, roles: ['admin'] })
    assert.equal(response.status, 201)
    assert.deepEqual(response.data.roles, ['buyer'])
    if (roles) {
      const account = { ...response.data, roles }
      app.store.db.prepare('UPDATE accounts SET data=? WHERE id=?').run(JSON.stringify(account), account.id)
    }
    app.store.db.prepare('DELETE FROM limits WHERE key=?').run('mail-v2:' + hashToken(address))
    return { call, account: response.data }
  }
  const notify = (order, changes = {}) => {
    const values = { pid: config.zpayPid, out_trade_no: order.id, trade_no: `provider-${order.id}`, trade_status: 'TRADE_SUCCESS', type: 'alipay', money: order.paymentCny.toFixed(2), ...changes }
    return '/payments/zpay/notify?' + new URLSearchParams({ ...values, sign: signZpay(values, config.zpayKey), sign_type: 'MD5' })
  }
  return { client, register, messages, config, notify, directory, store: () => app.store,
    restart: async () => { await app.close(); app = createApplication(config, { sendMail: async mail => messages.push(mail) }); base = await listen() } }
}
async function publish(seller, admin, price = 10) {
  const response = await seller('/studio/products', 'POST', productInput(price)); assert.equal(response.status, 201)
  const product = response.data
  const form = new FormData(); form.append('file', new Blob(['private package bytes']), 'pet.mspet')
  assert.equal((await seller(`/files/${product.id}`, 'PUT', form)).status, 200)
  assert.equal((await admin(`/admin/listings/${product.id}`, 'PATCH', { status: 'approved' })).status, 204)
  return product
}

test('real HTTP lifecycle: sessions, ZPAY authoritative totals, idempotent settlement, private delivery and payout transitions', async t => {
  const f = await fixture(t)
  const { call: admin } = await f.register('admin@example.com', ['admin'])
  const { call: seller } = await f.register('seller@example.com', ['creator'])
  const { call: buyer } = await f.register('buyer@example.com')
  const guest = f.client()
  assert.equal((await buyer('/studio/products', 'POST', productInput())).status, 403)
  assert.equal((await buyer('/studio/settings', 'PATCH', { platformFeePercent: 0 })).status, 403)
  const product = await publish(seller, admin)
  assert.equal((await guest('/catalogue')).data.length, 1)
  assert.equal((await buyer(`/files/${product.id}/content`)).status, 403)
  assert.equal((await guest(`/files/${product.id}/content`)).status, 401)
  assert.equal((await buyer(`/studio/products/${product.id}`, 'PATCH', productInput(0))).status, 403)
  const create = () => buyer('/orders', 'POST', { lines: [{ id: product.id, quantity: 1, price: 0.01, sellerId: 'tampered', platformFeePercent: 0 }] })
  const attempts = await Promise.all([create(), create()])
  assert.equal(attempts[0].status, 201)
  const order = attempts[0].data
  assert.equal(attempts[1].data.id, order.id)
  assert.equal(order.total, 10); assert.equal(order.paymentCny, 72); assert.equal(order.status, 'pending')
  assert.equal((await seller('/studio/ledger')).data.available, 0)
  assert.equal((await buyer(`/downloads/${product.id}`, 'POST')).status, 403)
  const checkout = await buyer(order.paymentUrl.replace('/api', ''))
  assert.match(checkout.data, /https:\/\/zpayz.cn\/submit.php/)
  assert.match(checkout.data, /72.00/)
  assert.doesNotMatch(checkout.data, /private-test-key/)
  assert.equal((await guest(f.notify(order, { money: '0.01' }))).status, 400)
  assert.equal((await guest(f.notify(order).replace(/sign=[^&]+/, 'sign=00000000000000000000000000000000'))).status, 400)
  assert.equal((await guest('/payments/zpay/return?out_trade_no=' + order.id)).status, 303)
  assert.equal((await buyer('/orders')).data[0].status, 'pending')
  assert.equal((await guest(f.notify(order))).data, 'success')
  assert.equal((await guest(f.notify(order))).data, 'success')
  assert.equal((await buyer('/orders')).data[0].status, 'paid')
  assert.equal((await create()).status, 409)
  assert.equal((await seller('/studio/ledger')).data.available, 9.2)
  assert.equal((await seller('/studio/ledger')).data.sales.length, 1)
  await admin('/studio/settings', 'PATCH', { platformFeePercent: 50 })
  assert.equal((await seller('/studio/ledger')).data.available, 9.2)
  const download = await buyer(`/downloads/${product.id}`, 'POST')
  assert.equal((await buyer(download.data.url.replace('/api', ''))).data, 'private package bytes')
  const revised = new FormData(); revised.append('file', new Blob(['unreviewed replacement']), 'pet.mspet')
  assert.equal((await seller(`/files/${product.id}`, 'PUT', revised)).status, 200)
  assert.equal((await buyer(download.data.url.replace('/api', ''))).data, 'private package bytes')
  const draft = (await admin(`/files/${product.id}`)).data
  assert.equal((await admin(draft.url.replace('/api', ''))).data, 'unreviewed replacement')
  assert.equal((await buyer(draft.url.replace('/api', ''))).status, 403)
  assert.equal((await admin(`/admin/listings/${product.id}`, 'PATCH', { status: 'approved' })).status, 204)
  assert.equal((await buyer(download.data.url.replace('/api', ''))).data, 'unreviewed replacement')
  assert.equal((await seller(`/files/${product.id}`, 'DELETE')).status, 409)
  assert.equal((await buyer('/auth/profile', 'PATCH', { name: 'changed' }, { Origin: 'https://attacker.example' })).status, 403)
  assert.equal((await seller('/studio/withdrawals', 'POST', { amount: 10, destination: 'Alipay seller@example.com (Seller)' })).status, 409)
  const requests = await Promise.all([1, 2].map(() => seller('/studio/withdrawals', 'POST', { amount: 9, destination: 'Alipay seller@example.com (Seller)' })))
  assert.deepEqual(requests.map(r => r.status).sort(), [201, 409])
  const withdrawal = requests.find(r => r.status === 201).data
  assert.equal((await admin(`/admin/withdrawals/${withdrawal.id}`, 'PATCH', { status: 'paid', note: 'ref' })).status, 409)
  assert.equal((await admin(`/admin/withdrawals/${withdrawal.id}`, 'PATCH', { status: 'approved' })).status, 204)
  assert.equal((await admin(`/admin/withdrawals/${withdrawal.id}`, 'PATCH', { status: 'paid' })).status, 400)
  assert.equal((await admin(`/admin/withdrawals/${withdrawal.id}`, 'PATCH', { status: 'paid', note: 'Transfer reference 123' })).status, 204)
  assert.equal((await admin(`/admin/withdrawals/${withdrawal.id}`, 'PATCH', { status: 'rejected', note: 'undo' })).status, 409)
  assert.equal((await seller('/studio/ledger')).data.available, 0.2)
  await seller(`/studio/products/${product.id}`, 'DELETE')
  assert.equal((await guest('/catalogue')).data.length, 0)
  assert.equal((await buyer(download.data.url.replace('/api', ''))).status, 200)
  await f.restart()
  assert.equal((await buyer('/auth/session')).data.email, 'buyer@example.com')
  assert.equal((await buyer('/orders')).data[0].status, 'paid')
  assert.equal((await buyer(download.data.url.replace('/api', ''))).status, 200)
})

test('account verification/reset tokens are single-use, password hashes are salted and sessions are revoked', async t => {
  const f = await fixture(t)
  const { call: user, account } = await f.register('person@example.com')
  await f.register('second@example.com')
  const rows = f.store().db.prepare('SELECT password FROM accounts').all()
  assert.notEqual(rows[0].password, rows[1].password)
  assert.ok(rows.every(row => !row.password.includes(password)))
  const cookie = (await user('/auth/sign-in', 'POST', { email: account.email, password })).headers.get('set-cookie')
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/)
  assert.equal(account.emailVerified, true)
  assert.equal((await user('/auth/email/verify', 'POST')).status, 410)
  assert.equal((await user('/auth/email/verify?token=old-link')).status, 410)
  assert.equal((await user('/auth/profile', 'PATCH', { email: 'unverified@example.com' })).status, 409)
  assert.equal((await user('/auth/session')).data.email, account.email)
  f.store().db.prepare('UPDATE accounts SET data=? WHERE id=?').run(JSON.stringify({ ...account, emailVerified: false }), account.id)
  const guest = f.client()
  assert.equal((await guest('/auth/password/reset/code', 'POST', { email: 'missing@example.com' })).status, 200)
  assert.equal((await guest('/auth/password/reset/code', 'POST', { email: account.email })).status, 200)
  const resetToken = f.messages.at(-1).text.match(/\d{6}/)[0]
  assert.equal((await guest('/auth/password/reset', 'POST', { email: account.email, code: resetToken, password: 'new-password-456' })).status, 204)
  assert.equal((await user('/auth/session')).data, null)
  assert.equal((await guest('/auth/password/reset', 'POST', { email: account.email, code: resetToken, password: 'another-password' })).status, 400)
  assert.equal((await user('/auth/sign-in', 'POST', { email: account.email, password })).status, 401)
  assert.equal((await user('/auth/sign-in', 'POST', { email: account.email, password: 'new-password-456' })).status, 200)
  assert.equal((await user('/auth/session')).data.emailVerified, true)
  assert.equal((await user('/auth/account', 'DELETE')).status, 204)
  assert.equal((await user('/auth/session')).data, null)
})

test('moderation, upload validation, tickets and reports are isolated between accounts', async t => {
  const f = await fixture(t)
  const { call: admin } = await f.register('admin@example.com', ['admin'])
  const { call: seller } = await f.register('seller@example.com', ['creator'])
  const { call: buyer } = await f.register('buyer@example.com')
  const { call: other } = await f.register('other@example.com', ['creator'])
  const candidate = (await seller('/studio/products', 'POST', { ...productInput(0), sellerId: 'forged', id: 'forged', archived: true })).data
  assert.notEqual(candidate.id, 'forged'); assert.notEqual(candidate.sellerId, 'forged')
  assert.equal((await admin(`/admin/listings/${candidate.id}`, 'PATCH', { status: 'approved' })).status, 409)
  assert.equal((await other(`/studio/products/${candidate.id}`, 'PATCH', productInput())).status, 403)
  assert.equal((await seller('/studio/products', 'POST', { ...productInput(), image: 'javascript:alert(1)' })).status, 400)
  const form = new FormData(); form.append('file', new Blob(['archive']), 'pack.zip')
  assert.equal((await other(`/files/${candidate.id}`, 'PUT', form)).status, 403)
  assert.equal((await seller(`/files/${candidate.id}`, 'PUT', form)).status, 200)
  await admin(`/admin/listings/${candidate.id}`, 'PATCH', { status: 'approved' })
  const purchase = await buyer('/orders', 'POST', { lines: [{ id: candidate.id, quantity: 1 }] })
  assert.equal(purchase.data.status, 'paid')
  assert.equal((await buyer('/support/tickets', 'POST', { subject: 'Help me', message: 'There is an issue with the download', orderId: purchase.data.id })).status, 204)
  assert.equal((await other('/support/tickets', 'POST', { subject: 'Help me', message: 'This is another account order', orderId: purchase.data.id })).status, 400)
  assert.equal((await other('/community')).data.tickets.length, 0)
  const ticket = (await admin('/community')).data.tickets[0]
  assert.equal((await buyer(`/admin/tickets/${ticket.id}`, 'PATCH', { reply: 'forged' })).status, 403)
  assert.equal((await admin(`/admin/tickets/${ticket.id}`, 'PATCH', { reply: 'Please try again.' })).status, 204)
  assert.equal((await buyer('/community')).data.tickets[0].reply, 'Please try again.')
  assert.equal((await buyer('/reports', 'POST', { productId: candidate.id, productName: 'forged', reason: 'broken', detail: 'Missing a frame' })).status, 204)
  assert.equal((await other('/community')).data.reports.length, 0)
  const report = (await admin('/community')).data.reports[0]
  assert.equal(report.productName, '测试宠物')
  assert.equal((await admin(`/admin/reports/${report.id}`, 'PATCH', { status: 'resolved' })).status, 204)
  await seller(`/studio/products/${candidate.id}`, 'PATCH', productInput(0))
  assert.equal((await buyer('/catalogue')).data.length, 0)
  assert.equal((await buyer(`/downloads/${candidate.id}`, 'POST')).status, 200)
})

test('unconfigured payment fails closed; static server never exposes archives; login throttling', async t => {
  const f = await fixture(t, { zpayKey: '', zpayPid: '' })
  const { call: admin } = await f.register('admin@example.com', ['admin'])
  const { call: buyer } = await f.register('buyer@example.com')
  const product = await publish(admin, admin)
  const result = await buyer('/orders', 'POST', { lines: [{ id: product.id, quantity: 1 }] })
  assert.equal(result.status, 503); assert.equal(result.data.error.code, 'payment-unavailable')
  assert.equal((await buyer('/orders')).data.length, 0)
  await mkdir(join(f.directory, 'dist'), { recursive: true })
  await writeFile(join(f.directory, 'dist', 'secret.zip'), 'private')
  // Client helper prepends /api: normalization resolves /api/../secret.zip to /secret.zip.
  assert.equal((await buyer('/../secret.zip')).status, 404)
  const guest = f.client()
  for (let attempt = 0; attempt < 15; attempt++) assert.equal((await guest('/auth/sign-in', 'POST', { email: 'bad@example.com', password })).status, 401)
  assert.equal((await guest('/auth/sign-in', 'POST', { email: 'bad@example.com', password })).status, 429)
})

test('missing callbacks can be reconciled with the provider and mismatched responses cannot settle another order', async t => {
  let mismatch = true
  const f = await fixture(t, { queryPayment: async order => ({ code: 1, status: 1, out_trade_no: mismatch ? 'wrong-order' : order.id, pid: 'test-merchant', money: (order.cnyCents / 100).toFixed(2), type: order.paymentType, trade_no: `query-${order.id}` }) })
  const { call: admin } = await f.register('admin@example.com', ['admin'])
  const { call: buyer } = await f.register('buyer@example.com')
  const { call: other } = await f.register('other@example.com')
  const product = await publish(admin, admin, 1.25)
  const order = (await buyer('/orders', 'POST', { lines: [{ id: product.id, quantity: 2 }], paymentType: 'wxpay' })).data
  assert.equal(order.paymentCny, 18)
  assert.equal((await other(`/orders/${order.id}/reconcile`, 'POST')).status, 404)
  assert.equal((await buyer(`/orders/${order.id}/reconcile`, 'POST')).status, 502)
  assert.equal((await buyer('/orders')).data[0].status, 'pending')
  mismatch = false
  assert.equal((await buyer(`/orders/${order.id}/reconcile`, 'POST')).data.status, 'paid')
  assert.equal((await buyer(`/orders/${order.id}/reconcile`, 'POST')).data.status, 'paid')
  assert.equal((await buyer('/orders')).data.length, 1)
})

test('role groups: inheritance, administrator assignment, session revocation and self protection', async t => {
  const f = await fixture(t)
  const { call: admin, account: adminAccount } = await f.register('groups-admin@example.com', ['admin'])
  const { call: buyer, account: buyerAccount } = await f.register('groups-user@example.com')
  assert.equal((await buyer('/admin/users')).status, 403)
  assert.equal((await buyer(`/admin/users/${buyerAccount.id}/role`, 'PATCH', { role: 'admin' })).status, 403)
  assert.equal((await admin('/admin/users')).status, 200)
  assert.equal((await admin(`/admin/users/${adminAccount.id}/role`, 'PATCH', { role: 'buyer' })).status, 409)
  assert.equal((await admin(`/admin/users/${buyerAccount.id}/role`, 'PATCH', { role: 'root' })).status, 400)
  const promoted = await admin(`/admin/users/${buyerAccount.id}/role`, 'PATCH', { role: 'creator' })
  assert.equal(promoted.status, 200)
  assert.deepEqual(promoted.data.roles, ['buyer', 'creator'])
  assert.equal((await buyer('/auth/session')).data, null)
  await buyer('/auth/sign-in', 'POST', { email: 'groups-user@example.com', password })
  assert.equal((await buyer('/orders')).status, 200)
  assert.equal((await buyer('/studio/products', 'POST', productInput())).status, 201)
  assert.equal((await buyer('/admin/users')).status, 403)
  assert.equal((await admin('/studio/products', 'POST', productInput())).status, 201)
  assert.equal((await admin(`/admin/users/${buyerAccount.id}/role`, 'PATCH', { role: 'buyer' })).status, 200)
  assert.equal((await buyer('/auth/session')).data, null)
  await buyer('/auth/sign-in', 'POST', { email: 'groups-user@example.com', password })
  assert.equal((await buyer('/studio/products', 'POST', productInput())).status, 403)
})


test('pet listing retains frame timings and interaction triggers and rejects broken references', async t => {
  const f = await fixture(t)
  const { call: seller } = await f.register('pet-seller@example.com', ['creator'])
  const sheet = { dir: 'imported-idle', sources: ['data:image/png;base64,AA==', 'data:image/png;base64,AA=='], frames: 2, frameWidth: 16, frameHeight: 16, duration: 300, durations: [100, 200] }
  const triggers = [{ id: 'IDLE', event: 'pet.drag-start', repeat: false, cooldownMs: 1000, idleSeconds: 5, tool: '' }]
  const input = { ...productInput(0), animations: { order: ['IDLE'], sheets: { IDLE: sheet }, labels: { IDLE: { zh: '待机', en: 'Idle' } }, idle: sheet, triggers } }
  const created = await seller('/studio/products', 'POST', input)
  assert.equal(created.status, 201)
  assert.deepEqual(created.data.animations.sheets.IDLE.durations, [100, 200])
  assert.deepEqual(created.data.animations.triggers, triggers)
  input.animations.triggers[0].id = 'missing'
  assert.equal((await seller('/studio/products', 'POST', input)).status, 400)
  input.animations.triggers[0].id = 'IDLE'
  input.animations.sheets.IDLE.durations = [100]
  assert.equal((await seller('/studio/products', 'POST', input)).status, 400)
})


test('admin data browser: safe projections, search, filters, pagination and read-only access', async t => {
  const f = await fixture(t)
  const { call: admin } = await f.register('browser-admin@example.com', ['admin'])
  const { call: merchant } = await f.register('browser-merchant@example.com', ['creator'])
  const { call: buyer, account } = await f.register('browser-buyer@example.com')
  assert.equal((await f.client()('/admin/data')).status, 401)
  assert.equal((await merchant('/admin/data')).status, 403)
  assert.equal((await buyer('/admin/data')).status, 403)
  const db = f.store().db
  for (let i = 0; i < 30; i++) f.store().put('ticket', { id: `ticket-${i}`, subject: `Support ${i}`, message: i === 0 ? 'literal % search' : 'Message', accountId: account.id, status: i % 2 ? 'answered' : 'open', createdAt: 1000 + i }, account.id)
  const page1 = await admin('/admin/data?dataset=tickets')
  assert.equal(page1.status, 200)
  assert.equal(page1.headers.get('cache-control'), 'no-store')
  assert.equal(page1.data.total, 30)
  assert.equal(page1.data.rows.length, 25)
  const page2 = await admin('/admin/data?dataset=tickets&page=2')
  assert.equal(page2.data.rows.length, 5)
  assert.ok(!page1.data.rows.some(row => page2.data.rows.some(other => other.id === row.id)))
  assert.equal((await admin('/admin/data?dataset=tickets&status=open')).data.total, 15)
  assert.equal((await admin('/admin/data?dataset=tickets&q=%25')).data.total, 1)
  assert.equal((await admin('/admin/data?dataset=tickets&q=absent&page=10')).data.page, 1)
  const product = await publish(merchant, admin, 0)
  await buyer('/orders', 'POST', { lines: [{ id: product.id, quantity: 1 }] })
  f.store().put('withdrawal', { id: 'wd-browse', amount: 12, status: 'requested', destination: 'private-payment-account', requestedAt: 3000 }, account.id)
  for (const dataset of ['users', 'products', 'orders', 'withdrawals', 'files', 'events']) {
    const result = await admin('/admin/data?dataset=' + dataset)
    assert.equal(result.status, 200, dataset)
    assert.ok(result.data.rows.length > 0, dataset)
    assert.ok(result.data.rows.every(row => Object.keys(row).every(key => result.data.columns.some(col => col.key === key))))
    assert.ok(!JSON.stringify(result.data).includes('private-payment-account'))
    assert.ok(!JSON.stringify(result.data).includes('password'))
  }
  assert.equal((await admin('/admin/data?dataset=products&status=approved')).data.rows[0].price, 0)
  assert.equal((await admin('/admin/data?dataset=orders')).data.rows[0].amount, 0)
  assert.equal((await admin('/admin/data?dataset=users&status=creator')).data.total, 1)
  const hash = db.prepare('SELECT password FROM accounts WHERE id=?').get(account.id).password
  assert.equal((await admin('/admin/data?dataset=users&q=' + encodeURIComponent(hash))).data.total, 0)
  for (const query of ['dataset=sessions', 'dataset=__proto__', 'dataset=accounts', 'page=-1', 'page=1.5', 'status=unknown', "dataset=users%27%3BDELETE%20FROM%20accounts"]) assert.equal((await admin('/admin/data?' + query)).status, 400)
  assert.equal((await admin('/admin/data', 'POST', { sql: 'DELETE FROM accounts' })).status, 404)
  assert.equal(db.prepare('SELECT count(*) AS n FROM accounts').get().n, 3)
})


test('registration requires a single-use email code with expiry, attempt and resend limits', async t => {
  const f = await fixture(t)
  const client = f.client()
  const email = 'verify-registration@example.com'
  const body = { name: '注册测试', email, password }
  assert.equal((await client('/auth/register', 'POST', body)).status, 400)
  assert.equal((await client('/auth/register/code', 'POST', { email })).status, 200)
  const code = f.messages.at(-1).text.match(/\d{6}/)[0]
  assert.equal((await client('/auth/register/code', 'POST', { email })).status, 429)
  assert.equal((await client('/auth/register', 'POST', { ...body, email: 'wrong@example.com', code })).status, 400)
  const wrong = code === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) assert.equal((await client('/auth/register', 'POST', { ...body, code: wrong })).status, 400)
  assert.equal((await client('/auth/register', 'POST', { ...body, code })).status, 400)
  const db = f.store().db
  db.prepare('UPDATE registration_codes SET attempts=0,expires=? WHERE email=?').run(Date.now() - 1, email)
  assert.equal((await client('/auth/register', 'POST', { ...body, code })).status, 400)
  db.prepare('UPDATE registration_codes SET expires=? WHERE email=?').run(Date.now() + 600000, email)
  const result = await client('/auth/register', 'POST', { ...body, code })
  assert.equal(result.status, 201)
  assert.equal(result.data.emailVerified, true)
  assert.equal(db.prepare('SELECT count(*) AS n FROM registration_codes WHERE email=?').get(email).n, 0)
  assert.equal((await client('/auth/register', 'POST', { ...body, code })).status, 409)
})


test('reset codes are email bound, expire, limit attempts and remain separate from registration', async t => {
  const f = await fixture(t)
  const { account } = await f.register('reset-test@example.com')
  const call = f.client()
  assert.equal((await call('/auth/password/reset/code', 'POST', { email: account.email })).status, 200)
  const code = f.messages.at(-1).text.match(/\d{6}/)[0]
  assert.equal((await call('/auth/password/reset/code', 'POST', { email: account.email })).status, 429)
  assert.equal((await call('/auth/password/reset', 'POST', { email: 'elsewhere@example.com', code, password })).status, 400)
  const wrong = code === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) assert.equal((await call('/auth/password/reset', 'POST', { email: account.email, code: wrong, password })).status, 400)
  assert.equal((await call('/auth/password/reset', 'POST', { email: account.email, code, password })).status, 400)
  f.store().db.prepare('UPDATE registration_codes SET attempts=0,expires=0 WHERE email=?').run(`reset:${account.id}`)
  assert.equal((await call('/auth/password/reset', 'POST', { email: account.email, code, password })).status, 400)
})


test('mail limits count accepted mail only, retain failure cooldown and return exact retry windows', async t => {
  let fail = true, sent = 0
  const f = await fixture(t, { sendMail: async () => { if (fail) throw new Error('SMTP failed'); sent++ } })
  const call = f.client(), address = 'limits@example.com', key = 'mail-v2:' + hashToken(address)
  const send = () => call('/auth/register/code', 'POST', { email: address })
  let result = await send()
  assert.equal(result.status, 503)
  assert.equal(result.headers.get('retry-after'), '30')
  assert.equal(f.store().db.prepare('SELECT count FROM limits WHERE key=?').get(key + ':hour'), undefined)
  const before = f.store().db.prepare('SELECT * FROM limits WHERE key=?').get(key)
  result = await send()
  assert.equal(result.status, 429)
  assert.ok(result.data.error.retryAfter > 0 && result.data.error.retryAfter <= 30)
  assert.deepEqual(f.store().db.prepare('SELECT * FROM limits WHERE key=?').get(key), before)
  fail = false
  for (let i = 0; i < 10; i++) {
    f.store().db.prepare('DELETE FROM limits WHERE key=?').run(key)
    assert.equal((await send()).status, 200)
  }
  result = await send()
  assert.equal(result.status, 429)
  assert.ok(result.data.error.retryAfter > 3500)
  assert.equal(sent, 10)
  assert.equal(f.store().db.prepare('SELECT count FROM limits WHERE key=?').get(key + ':hour').count, 10)
})


test('free packs grant download access without ZPAY, including a sellers own free pack', async t => {
  const f = await fixture(t, { zpayKey: '', zpayPid: '' })
  const { call: seller } = await f.register('free-seller@example.com', ['admin'])
  const { call: buyer } = await f.register('free-buyer@example.com')
  const product = await publish(seller, seller, 0)
  for (const call of [seller, buyer]) {
    const result = await call('/orders', 'POST', { lines: [{ id: product.id, quantity: 1 }] })
    assert.equal(result.status, 201)
    assert.equal(result.data.status, 'paid')
    assert.equal(result.data.paymentCny, 0)
    assert.equal(result.data.paymentUrl, undefined)
    assert.ok(f.store().db.prepare('SELECT 1 FROM entitlements WHERE order_id=?').get(result.data.id))
    assert.equal((await call('/orders', 'POST', { lines: [{ id: product.id, quantity: 1 }] })).data.error.code, 'owned')
  }
})
