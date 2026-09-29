import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApplication } from '../server/app.mjs'
import { configuration } from '../server/config.mjs'
import { signZpay } from '../server/payments.mjs'
import { serveStatic } from '../server/static.mjs'

const password = 'test-password-123'
const productInput = (price = 10) => ({ name: { zh: '测试宠物', en: 'Test pet' }, tagline: { zh: '动画', en: 'Animation' }, body: { zh: '测试交付包', en: 'Test delivery' }, price, category: 'pets', size: '1 pet', formats: ['mspet'], tags: [] })
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'moonsprite-backend-'))
  const messages = []
  const config = { ...configuration({ DATA_DIR: directory }), zpayPid: 'test-merchant', zpayKey: 'private-test-key', ...options }
  let app = createApplication(config, { sendMail: async mail => messages.push(mail), queryPayment: options.queryPayment, serveAsset: serveStatic(join(directory, 'dist')) })
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
    const call = client(), response = await call('/auth/register', 'POST', { name: address.split('@')[0], email: address, password, roles: ['admin'] })
    assert.equal(response.status, 201)
    assert.deepEqual(response.data.roles, ['buyer'])
    if (roles) {
      const account = { ...response.data, roles }
      app.store.db.prepare('UPDATE accounts SET data=? WHERE id=?').run(JSON.stringify(account), account.id)
    }
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
  assert.equal((await user('/auth/email/verify', 'POST')).data.emailVerified, false)
  const verify = new URL(f.messages[0].text.match(/https?:\/\/\S+/)[0])
  const token = verify.searchParams.get('token')
  assert.equal((await user('/auth/email/verify?token=' + token)).status, 200)
  assert.equal((await user('/auth/session')).data.emailVerified, false)
  assert.equal((await user('/auth/email/verify', 'POST', { token })).status, 200)
  assert.equal((await user('/auth/session')).data.emailVerified, true)
  assert.equal((await user('/auth/email/verify', 'POST', { token })).status, 400)
  const guest = f.client()
  assert.equal((await guest('/auth/password/reset', 'POST', { email: 'missing@example.com' })).status, 204)
  assert.equal((await guest('/auth/password/reset', 'POST', { email: account.email })).status, 204)
  const resetToken = new URL(f.messages.at(-1).text.match(/https?:\/\/\S+/)[0]).searchParams.get('token')
  assert.equal((await guest('/auth/password/reset', 'POST', { token: resetToken, password: 'new-password-456' })).status, 200)
  assert.equal((await user('/auth/session')).data, null)
  assert.equal((await guest('/auth/password/reset', 'POST', { token: resetToken, password: 'another-password' })).status, 400)
  assert.equal((await user('/auth/sign-in', 'POST', { email: account.email, password })).status, 401)
  assert.equal((await user('/auth/sign-in', 'POST', { email: account.email, password: 'new-password-456' })).status, 200)
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
