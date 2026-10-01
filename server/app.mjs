import { verificationEmail } from './email-template.mjs'
import { browseData } from './data-browser.mjs'
import { roleGroups } from './roles.mjs'
import { createServer } from 'node:http'
import { randomUUID, randomInt } from 'node:crypto'
import { isIP } from 'node:net'
import { openDatabase } from './database.mjs'
import { authentication, hashPassword, checkPassword, hashToken, randomToken } from './auth.mjs'
import { HttpError, requireValue, string, email, password, cents, listing } from './validation.mjs'
import { paymentParameters, verifyZpay, notificationAmount, queryZpay } from './payments.mjs'
import { createMailer } from './mail.mjs'

const id = prefix => `${prefix}_${randomUUID()}`
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const json = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)) }
const empty = res => { res.writeHead(204); res.end() }
const plain = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(value) }
function html(res, title, content, formOrigin = "'self'") {
  // Native form POSTs need their same-origin Origin header. no-referrer can
  // make browsers send Origin: null; retain no referrer on external links.
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; form-action ${formOrigin}; frame-ancestors 'none'; base-uri 'none'`)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(title)} · MoonSprite</title><body style="font:16px system-ui;max-width:640px;margin:12vh auto;padding:24px;line-height:1.8"><h1>${escape(title)}</h1>${content}<p><a href="/">返回 MoonSprite</a></p></body></html>`)
}
function parameters(search) {
  requireValue([...search.keys()].every(key => search.getAll(key).length === 1), 'duplicate-parameter')
  return Object.fromEntries(search)
}
async function readBody(req, max) {
  requireValue(!req.headers['content-length'] || Number(req.headers['content-length']) <= max, 'too-large', 413)
  const chunks = []; let size = 0
  for await (const chunk of req) { size += chunk.length; requireValue(size <= max, 'too-large', 413); chunks.push(chunk) }
  return Buffer.concat(chunks)
}

export function createApplication(config, overrides = {}) {
  const store = openDatabase(config.database)
  const { db, get, list, put, transaction, audit } = store
  const auth = authentication(store, config)
  const sendMail = overrides.sendMail ?? createMailer(config)
  const queryPayment = overrides.queryPayment ?? queryZpay
  const accountRow = accountId => db.prepare('SELECT * FROM accounts WHERE id=?').get(accountId)
  const saveAccount = account => db.prepare('UPDATE accounts SET email=?,data=? WHERE id=?').run(account.email, JSON.stringify(account), account.id)
  const isAdmin = account => Boolean(account?.roles.includes('admin'))
  const owner = (account, productId) => {
    const product = get('product', productId)
    requireValue(product, 'missing', 404)
    requireValue(isAdmin(account) || product.sellerId === account.id, 'forbidden', 403)
    return product
  }
  const hasFile = productId => Boolean(db.prepare('SELECT 1 FROM files WHERE product_id=?').get(productId))
  const entitled = (accountId, productId) => Boolean(db.prepare('SELECT 1 FROM entitlements WHERE account_id=? AND product_id=?').get(accountId, productId))
  const review = productId => get('review', productId) ?? { id: productId, status: 'pending', at: 0 }
  const fee = () => get('settings', 'platform')?.percent ?? 8
  const limited = expires => {
    const error = new HttpError(429, 'rate-limited')
    error.retryAfter = Math.max(1, Math.ceil((expires - Date.now()) / 1000))
    throw error
  }
  const rateLimit = (key, max, duration = 15 * 60000) => {
    const now = Date.now()
    db.prepare('DELETE FROM limits WHERE expires<=?').run(now)
    const row = db.prepare('SELECT count,expires FROM limits WHERE key=?').get(key)
    if (row?.count >= max) limited(row.expires)
    db.prepare('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, now + duration)
  }
  // Reserve before awaiting SMTP so concurrent requests cannot send duplicate emails.
  const pendingMail = new Set()
  const beginMail = address => {
    const key = 'mail-v2:' + hashToken(address), now = Date.now()
    const rows = db.prepare('SELECT count,expires FROM limits WHERE key IN (?,?) AND expires>?').all(key, key + ':hour', now)
    const blocked = rows.filter(row => row.count >= 10 || row.count === -1)
    if (blocked.length) limited(Math.max(...blocked.map(row => row.expires)))
    if (pendingMail.has(key)) limited(now + 30000)
    pendingMail.add(key)
    db.prepare('INSERT OR REPLACE INTO limits VALUES(?,-1,?)').run(key, now + 30000)
    return success => {
      pendingMail.delete(key)
      db.prepare('UPDATE limits SET expires=? WHERE key=?').run(Date.now() + (success ? 60000 : 30000), key)
      if (success) {
        db.prepare('DELETE FROM limits WHERE key=? AND expires<=?').run(key + ':hour', Date.now())
        db.prepare('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key + ':hour', Date.now() + 3600000)
      }
    }
  }
  const publicOrder = order => ({ id: order.id, createdAt: order.createdAt, total: order.total, lines: order.lines.map(({ sellerId, feeCents, ...line }) => line), status: order.status,
    paymentCny: order.cnyCents / 100, ...(order.status === 'pending' ? { paymentUrl: `/api/payments/${order.id}/checkout` } : {}) })
  const completeOrder = order => {
    if (order.status === 'paid') return order
    requireValue(order.status === 'pending', 'payment-state', 409)
    for (const line of order.lines) db.prepare('INSERT INTO entitlements VALUES(?,?,?)').run(order.accountId, line.id, order.id)
    order.status = 'paid'; order.paidAt = Date.now()
    put('order', order, order.accountId)
    audit(order.accountId, 'order.paid', order.id)
    return order
  }
  const settlePayment = values => transaction(() => {
    const order = get('order', values.out_trade_no)
    requireValue(order, 'missing', 404)
    requireValue(String(values.pid) === config.zpayPid && order.cnyCents > 0 && order.cnyCents === notificationAmount(String(values.money)) && values.type === order.paymentType, 'payment-amount')
    const tradeNo = string(values.trade_no, 'trade-no', 1, 100)
    requireValue(!order.tradeNo || order.tradeNo === tradeNo, 'payment-conflict', 409)
    requireValue(!get('payment', tradeNo) || get('payment', tradeNo).orderId === order.id, 'payment-conflict', 409)
    order.tradeNo = tradeNo
    completeOrder(order)
    put('payment', { id: tradeNo, orderId: order.id })
    return order
  })
  const ledger = account => {
    const orders = list('order').filter(order => order.status === 'paid')
    const sales = orders.flatMap(order => order.lines.filter(line => isAdmin(account) || line.sellerId === account.id).map(line => ({
      orderId: order.id, createdAt: order.paidAt, productId: line.id, name: line.name, quantity: line.quantity,
      gross: line.price * line.quantity, platformFeePercent: line.platformFeePercent, feeCents: line.feeCents,
    })))
    const withdrawals = list('withdrawal', isAdmin(account) ? undefined : account.id)
    const grossCents = sales.reduce((sum, line) => sum + Math.round(line.gross * 100), 0)
    const feeCents = sales.reduce((sum, line) => sum + line.feeCents, 0)
    const withdrawnCents = withdrawals.filter(item => item.status !== 'rejected').reduce((sum, item) => sum + Math.round(item.amount * 100), 0)
    return { gross: grossCents / 100, platformFee: feeCents / 100, net: (grossCents - feeCents) / 100, withdrawn: withdrawnCents / 100,
      available: (grossCents - feeCents - withdrawnCents) / 100, sales: sales.map(({ feeCents, ...line }) => line), withdrawals }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
    try {
      const url = new URL(req.url, config.publicOrigin)
      const path = url.pathname
      const method = req.method
      if (!path.startsWith('/api/') && overrides.serveAsset) return await overrides.serveAsset(req, res)
      requireValue(path.startsWith('/api/'), 'missing', 404)
      if (req.headers.origin) requireValue(req.headers.origin === config.publicOrigin, 'origin', 403)
      if (!['GET', 'HEAD'].includes(method)) {
        // Cookies are never sufficient to authorize cross-site writes.
        requireValue(req.headers['sec-fetch-site'] !== 'cross-site', 'origin', 403)
        requireValue(req.headers.origin === config.publicOrigin || req.headers['x-moonsprite-client'] === 'web', 'origin', 403)
      }
      const forwarded = req.headers['x-real-ip']
      const clientIp = config.trustProxy && typeof forwarded === 'string' && isIP(forwarded) ? forwarded : req.socket.remoteAddress
      rateLimit(`ip:${clientIp}`, 600, 60000)
      if (path.startsWith('/api/auth/') && method === 'POST') rateLimit(`auth:${clientIp}`, 40)
      let body = {}
      if (!['GET', 'HEAD'].includes(method) && !path.startsWith('/api/files/')) {
        const raw = await readBody(req, 4 * 1024 * 1024)
        if (raw.length) {
          const type = req.headers['content-type']?.split(';')[0]
          if (type === 'application/json') {
            try { body = JSON.parse(raw.toString()) } catch { throw new HttpError(400, 'invalid-json') }
            requireValue(body && typeof body === 'object' && !Array.isArray(body))
          } else if (type === 'application/x-www-form-urlencoded' && path.startsWith('/api/auth/')) body = parameters(new URLSearchParams(raw.toString()))
          else throw new HttpError(415, 'content-type')
        }
      }
      if (method === 'GET' && path === '/api/health') return json(res, { ok: true })
      if (method === 'GET' && path === '/api/auth/session') return json(res, auth.current(req))
      if (method === 'POST' && path === '/api/auth/register/code') {
        const address = email(body.email)
        rateLimit(`mail-v2-ip:${clientIp}`, 30, 3600000)
        requireValue(!db.prepare('SELECT 1 FROM accounts WHERE email=?').get(address), 'exists', 409)
        const finishMail = beginMail(address)
        const code = String(randomInt(0, 1000000)).padStart(6, '0')
        const salt = randomToken()
        const digest = `${salt}:${hashToken(`${salt}:${address}:${code}`)}`
        db.prepare('DELETE FROM registration_codes WHERE expires <= ?').run(Date.now())
        db.prepare('INSERT INTO registration_codes VALUES(?,?,?,0) ON CONFLICT(email) DO UPDATE SET digest=excluded.digest,expires=excluded.expires,attempts=0').run(address, digest, Date.now() + 600000)
        try { await sendMail(verificationEmail({ to: address, code, purpose: 'register', publicOrigin: config.publicOrigin })) }
        catch { finishMail(false); db.prepare('DELETE FROM registration_codes WHERE email=? AND digest=?').run(address, digest); const error = new HttpError(503, 'mail-unavailable'); error.retryAfter = 30; throw error }
        finishMail(true)
        return json(res, { retryAfter: 60, expiresIn: 600 })
      }
      if (method === 'POST' && path === '/api/auth/register') {
        const address = email(body.email); const name = string(body.name, 'name', 1, 40)
        const suppliedPassword = password(body.password)
        requireValue(!db.prepare('SELECT 1 FROM accounts WHERE email=?').get(address), 'exists', 409)
        const codeRow = db.prepare('SELECT * FROM registration_codes WHERE email=?').get(address)
        requireValue(codeRow && codeRow.expires > Date.now() && codeRow.attempts < 5, 'registration-code')
        const salt = codeRow.digest.split(':')[0]
        if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code) || codeRow.digest !== `${salt}:${hashToken(`${salt}:${address}:${body.code}`)}`) {
          db.prepare('UPDATE registration_codes SET attempts=attempts+1 WHERE email=?').run(address)
          throw new HttpError(400, 'registration-code')
        }
        const hashed = await hashPassword(suppliedPassword)
        const account = { id: id('usr'), email: address, name, roles: ['buyer'], createdAt: Date.now(), emailVerified: true }
        transaction(() => {
          requireValue(!db.prepare('SELECT 1 FROM accounts WHERE email=?').get(address), 'exists', 409)
          const current = db.prepare('SELECT * FROM registration_codes WHERE email=?').get(address)
          requireValue(current && current.digest === codeRow.digest && current.expires > Date.now() && current.attempts < 5, 'registration-code')
          db.prepare('INSERT INTO accounts VALUES(?,?,?,?)').run(account.id, address, hashed, JSON.stringify(account))
          db.prepare('DELETE FROM registration_codes WHERE email=?').run(address)
          auth.start(req, res, account)
        })
        return json(res, account, 201)
      }
      if (method === 'POST' && path === '/api/auth/sign-in') {
        const address = email(body.email); const supplied = password(body.password)
        rateLimit(`login:${hashToken(address)}`, 15)
        const row = db.prepare('SELECT * FROM accounts WHERE email=?').get(address)
        requireValue(await checkPassword(supplied, row?.password), 'credentials', 401)
        const account = JSON.parse(row.data); auth.start(req, res, account)
        return json(res, account)
      }
      if (method === 'POST' && path === '/api/auth/sign-out') { auth.end(req, res); return empty(res) }
      if (method === 'PATCH' && path === '/api/auth/profile') {
        const account = auth.requireAccount(req)
        if ('name' in body) account.name = string(body.name, 'name', 1, 40)
        if ('email' in body) requireValue(email(body.email) === account.email, 'email-change-disabled', 409)
        saveAccount(account); return json(res, account)
      }
      if (method === 'POST' && path === '/api/auth/password') {
        const account = auth.requireAccount(req); const row = accountRow(account.id)
        requireValue(await checkPassword(password(body.current), row.password), 'current', 400)
        requireValue(password(body.next) !== body.current, 'same')
        const hashed = await hashPassword(body.next)
        transaction(() => {
          requireValue(accountRow(account.id)?.password === row.password, 'conflict', 409)
          db.prepare('UPDATE accounts SET password=? WHERE id=?').run(hashed, account.id)
          db.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id)
          db.prepare('DELETE FROM tokens WHERE account_id=?').run(account.id)
          auth.start(req, res, account)
        }); return empty(res)
      }
      if (path === '/api/auth/email/verify') throw new HttpError(410, 'registration-verification-only')
      if (method === 'POST' && path === '/api/auth/password/reset/code') {
        const address = email(body.email)
        rateLimit(`mail-v2-ip:${clientIp}`, 30, 3600000)
        const row = db.prepare('SELECT id FROM accounts WHERE email=?').get(address)
        const finishMail = beginMail(address)
        let sent = !row
        if (row) {
          const key = `reset:${row.id}`
          const code = String(randomInt(0, 1000000)).padStart(6, '0'), salt = randomToken()
          const digest = `${salt}:${hashToken(`${salt}:${address}:${code}`)}`
          db.prepare('DELETE FROM registration_codes WHERE expires <= ?').run(Date.now())
          db.prepare('INSERT INTO registration_codes VALUES(?,?,?,0) ON CONFLICT(email) DO UPDATE SET digest=excluded.digest,expires=excluded.expires,attempts=0').run(key, digest, Date.now() + 600000)
          try { await sendMail(verificationEmail({ to: address, code, purpose: 'reset', publicOrigin: config.publicOrigin })); sent = true }
          catch { db.prepare('DELETE FROM registration_codes WHERE email=? AND digest=?').run(key, digest) }
        }
        finishMail(sent)
        return json(res, { retryAfter: sent ? 60 : 30, expiresIn: 600 })
      }
      if (method === 'POST' && path === '/api/auth/password/reset') {
        const address = email(body.email), next = password(body.password)
        const row = db.prepare('SELECT id FROM accounts WHERE email=?').get(address)
        const key = `reset:${row?.id}`
        const codeRow = db.prepare('SELECT * FROM registration_codes WHERE email=?').get(key)
        requireValue(row && codeRow && codeRow.expires > Date.now() && codeRow.attempts < 5, 'reset-code')
        const salt = codeRow.digest.split(':')[0]
        if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code) || codeRow.digest !== `${salt}:${hashToken(`${salt}:${address}:${body.code}`)}`) {
          db.prepare('UPDATE registration_codes SET attempts=attempts+1 WHERE email=?').run(key)
          throw new HttpError(400, 'reset-code')
        }
        const hashed = await hashPassword(next)
        transaction(() => {
          const current = db.prepare('SELECT * FROM registration_codes WHERE email=?').get(key)
          requireValue(current && current.digest === codeRow.digest && current.expires > Date.now() && current.attempts < 5, 'reset-code')
          requireValue(accountRow(row.id)?.email === address, 'reset-code')
          const verifiedAccount = { ...JSON.parse(accountRow(row.id).data), emailVerified: true }
          db.prepare('UPDATE accounts SET password=?, data=? WHERE id=?').run(hashed, JSON.stringify(verifiedAccount), row.id)
          db.prepare('DELETE FROM registration_codes WHERE email=?').run(key)
          db.prepare('DELETE FROM sessions WHERE account_id=?').run(row.id)
          db.prepare('DELETE FROM tokens WHERE account_id=?').run(row.id)
          audit(row.id, 'auth.reset', row.id)
        })
        return empty(res)
      }
      if (method === 'DELETE' && path === '/api/auth/account') {
        const account = auth.requireAccount(req)
        requireValue(!list('withdrawal', account.id).some(item => ['requested', 'approved'].includes(item.status)) && ledger({ ...account, roles: ['creator'] }).available <= 0, 'unsettled-balance', 409)
        requireValue(!list('order', account.id).some(item => item.status === 'pending'), 'pending-order', 409)
        transaction(() => {
          for (const product of list('product', account.id)) put('product', { ...product, archived: true }, account.id)
          // Keep financial records for reconciliation; remove login and personal support data.
          db.prepare('DELETE FROM records WHERE owner=? AND kind IN (\'ticket\',\'report\')').run(account.id)
          db.prepare('DELETE FROM entitlements WHERE account_id=?').run(account.id)
          db.prepare('DELETE FROM accounts WHERE id=?').run(account.id)
          audit(account.id, 'account.deleted', account.id)
        }); auth.end(req, res); return empty(res)
      }
      if (method === 'GET' && path === '/api/catalogue') return json(res, list('product').filter(product => !product.archived && review(product.id).status === 'approved' && hasFile(product.id)))
      if (method === 'GET' && path === '/api/studio/settings') return json(res, { percent: fee() })
      if (method === 'PATCH' && path === '/api/studio/settings') {
        const account = auth.requireAccount(req, 'admin'); const percent = body.platformFeePercent
        requireValue(Number.isInteger(percent) && percent >= 0 && percent <= 60, 'percent')
        put('settings', { id: 'platform', percent }); audit(account.id, 'fee.changed', String(percent)); return empty(res)
      }
      if (path === '/api/studio/products' || path.startsWith('/api/studio/products/')) {
        const account = auth.requireAccount(req, 'creator')
        if (method === 'GET' && path === '/api/studio/products') return json(res, list('product', isAdmin(account) ? undefined : account.id))
        const target = path.split('/')[4]
        if (method === 'DELETE' && target) { const product = owner(account, target); put('product', { ...product, archived: true }, product.sellerId); audit(account.id, 'product.archived', target); return empty(res) }
        if ((method === 'POST' && !target) || (method === 'PATCH' && target)) {
          const input = listing(body)
          for (const member of input.packs) { const product = owner(account, member); requireValue(product.category !== 'bundles' && !product.archived, 'packs') }
          const old = target ? owner(account, target) : null
          const product = { ...input, id: old?.id ?? id('pack'), sellerId: old?.sellerId ?? account.id, publishedAt: old?.publishedAt ?? Date.now(), updatedAt: Date.now(), archived: false }
          transaction(() => { put('product', product, product.sellerId); put('review', { id: product.id, status: 'pending', at: Date.now() }); audit(account.id, 'product.saved', product.id) })
          return json(res, product, old ? 200 : 201)
        }
      }
      if (path === '/api/orders' && method === 'GET') {
        const account = auth.current(req); return json(res, account ? list('order', account.id).map(publicOrder) : [])
      }
      if (path === '/api/orders' && method === 'POST') {
        const account = auth.requireAccount(req)
        requireValue(Array.isArray(body.lines) && body.lines.length > 0 && body.lines.length <= 50, 'lines')
        const paymentType = body.paymentType ?? 'alipay'; requireValue(['alipay', 'wxpay'].includes(paymentType), 'payment-type')
        const order = transaction(() => {
          const seen = new Set()
          const lines = body.lines.map(line => {
            requireValue(line && typeof line.id === 'string' && !seen.has(line.id) && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 99, 'quantity')
            seen.add(line.id)
            const product = get('product', line.id)
            requireValue(product && !product.archived && review(line.id).status === 'approved', 'unavailable', 409)
            requireValue(hasFile(product.id), 'missing-file', 409)
            requireValue(product.price === 0 || product.sellerId !== account.id, 'own-product', 409)
            requireValue(!entitled(account.id, product.id), 'owned', 409)
            return { id: product.id, name: product.name.zh, price: product.price, quantity: line.quantity, sellerId: product.sellerId, platformFeePercent: fee(), feeCents: Math.round(cents(product.price) * line.quantity * fee() / 100) }
          }).sort((a, b) => a.id.localeCompare(b.id))
          const totalCents = lines.reduce((sum, line) => sum + cents(line.price) * line.quantity, 0)
          const pending = list('order', account.id).filter(item => item.status === 'pending')
          const same = pending.find(item => JSON.stringify(item.lines.map(line => [line.id, line.quantity])) === JSON.stringify(lines.map(line => [line.id, line.quantity])) && item.paymentType === paymentType)
          if (same) return same // Retry pays the same immutable quote, never creates a second charge.
          requireValue(!pending.some(item => item.lines.some(line => seen.has(line.id))), 'pending-order', 409)
          requireValue(totalCents === 0 || (config.zpayPid && config.zpayKey), 'payment-unavailable', 503)
          const order = { id: `${Date.now()}${randomInt(100000000, 999999999)}`, accountId: account.id, createdAt: Date.now(), total: totalCents / 100,
            lines, status: 'pending', cnyCents: Math.round(totalCents * config.usdToCny), exchangeRate: config.usdToCny, paymentType }
          put('order', order, account.id)
          if (totalCents === 0) completeOrder(order)
          return order
        }); return json(res, publicOrder(order), 201)
      }
      const checkoutMatch = path.match(/^\/api\/payments\/(\d+)\/checkout$/)
      if (method === 'GET' && checkoutMatch) {
        const account = auth.requireAccount(req); const order = get('order', checkoutMatch[1])
        requireValue(order && order.accountId === account.id, 'missing', 404)
        requireValue(order.status === 'pending', 'payment-state', 409)
        const fields = paymentParameters(order, config)
        return html(res, '确认付款', `<p>订单：${escape(order.id)}</p><p>${escape(fields.name)}</p><p>实际支付：¥${escape(fields.money)} CNY（汇率 ${order.exchangeRate}）</p><form method="post" action="${escape(config.zpaySubmitUrl)}">${Object.entries(fields).map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`).join('')}<button type="submit">前往 ZPAY ${order.paymentType === 'wxpay' ? '微信' : '支付宝'}收银台</button></form>`, new URL(config.zpaySubmitUrl).origin)
      }
      if (method === 'GET' && path === '/api/payments/zpay/notify') {
        const values = parameters(url.searchParams)
        requireValue(verifyZpay(values, config.zpayKey) && values.pid === config.zpayPid, 'payment-signature', 400)
        requireValue(values.trade_status === 'TRADE_SUCCESS', 'payment-state')
        settlePayment(values); return plain(res, 'success')
      }
      const reconcileMatch = path.match(/^\/api\/orders\/(\d+)\/reconcile$/)
      if (method === 'POST' && reconcileMatch) {
        const account = auth.requireAccount(req)
        const order = get('order', reconcileMatch[1]); requireValue(order && (order.accountId === account.id || isAdmin(account)), 'missing', 404)
        if (order.status === 'paid') return json(res, publicOrder(order))
        rateLimit(`reconcile:${order.id}`, 6, 60000)
        const result = await queryPayment(order, config)
        requireValue(String(result.out_trade_no) === order.id, 'payment-order', 502)
        if (Number(result.status) === 1) return json(res, publicOrder(settlePayment(result)))
        return json(res, publicOrder(order))
      }
      if (method === 'GET' && path === '/api/payments/zpay/return') {
        // Browser redirects never grant access. A delayed callback remains pending.
        res.writeHead(303, { Location: '/#/purchases' }); return res.end()
      }
      if (method === 'GET' && path === '/api/studio/orders') {
        const account = auth.requireAccount(req, 'creator')
        return json(res, list('order').filter(item => item.status === 'paid').flatMap(order => {
          const lines = order.lines.filter(line => isAdmin(account) || line.sellerId === account.id)
          if (!lines.length) return []
          const { paymentCny, ...visible } = publicOrder({ ...order, lines, total: lines.reduce((sum, line) => sum + line.price * line.quantity, 0) })
          return [visible]
        }))
      }
      if (method === 'GET' && path === '/api/studio/ledger') return json(res, ledger(auth.requireAccount(req, 'creator')))
      if (method === 'POST' && path === '/api/studio/withdrawals') {
        const account = auth.requireAccount(req, 'creator')
        requireValue(Number.isSafeInteger(body.amount) && body.amount > 0, 'amount')
        const destination = string(body.destination, 'destination', 4, 160)
        requireValue(/^Alipay [^\r\n]+ \([^\r\n]+\)$/.test(destination), 'destination')
        const withdrawal = transaction(() => {
          requireValue(cents(body.amount) <= Math.round(ledger({ ...account, roles: ['creator'] }).available * 100), 'insufficient', 409)
          const result = put('withdrawal', { id: id('wd'), sellerId: account.id, amount: body.amount, status: 'requested', requestedAt: Date.now(), destination }, account.id)
          audit(account.id, 'withdrawal.requested', result.id); return result
        }); return json(res, withdrawal, 201)
      }
      if (method === 'GET' && path === '/api/admin/data') {
        auth.requireAccount(req, 'admin')
        res.setHeader('Cache-Control', 'no-store')
        return json(res, browseData(db, url.searchParams))
      }
      if (method === 'GET' && path === '/api/admin/users') {
        auth.requireAccount(req, 'admin')
        return json(res, db.prepare('SELECT data FROM accounts ORDER BY email').all().map(row => {
          const { id, name, email, roles, createdAt } = JSON.parse(row.data)
          return { id, name, email, roles, createdAt }
        }))
      }
      const userRoleMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/role$/)
      if (method === 'PATCH' && userRoleMatch) {
        const actor = auth.requireAccount(req, 'admin')
        requireValue(Object.hasOwn(roleGroups, body.role), 'role')
        const target = userRoleMatch[1]
        requireValue(actor.id !== target, 'cannot-change-self', 409)
        const account = transaction(() => {
          const row = db.prepare('SELECT data FROM accounts WHERE id=?').get(target)
          requireValue(row, 'missing', 404)
          const account = JSON.parse(row.data)
          if (account.roles.includes('admin') && body.role !== 'admin') {
            const admins = db.prepare('SELECT data FROM accounts').all().filter(row => JSON.parse(row.data).roles.includes('admin'))
            requireValue(admins.length > 1, 'last-admin', 409)
          }
          account.roles = roleGroups[body.role]
          db.prepare('UPDATE accounts SET data=? WHERE id=?').run(JSON.stringify(account), target)
          db.prepare('DELETE FROM sessions WHERE account_id=?').run(target)
          store.audit(actor.id, 'role.changed', target)
          return account
        })
        return json(res, account)
      }
      if (method === 'GET' && path === '/api/admin/withdrawals') { auth.requireAccount(req, 'admin'); return json(res, list('withdrawal')) }
      const withdrawalMatch = path.match(/^\/api\/admin\/withdrawals\/([^/]+)$/)
      if (method === 'PATCH' && withdrawalMatch) {
        const account = auth.requireAccount(req, 'admin')
        transaction(() => {
          const item = get('withdrawal', withdrawalMatch[1]); requireValue(item, 'missing', 404)
          const transitions = { requested: ['approved', 'rejected'], approved: ['paid', 'rejected'], paid: [], rejected: [] }
          requireValue(transitions[item.status].includes(body.status), 'transition', 409)
          const note = string(body.note ?? '', 'note', ['paid', 'rejected'].includes(body.status) ? 1 : 0, 1000)
          put('withdrawal', { ...item, status: body.status, note, decidedAt: Date.now() }, item.sellerId)
          audit(account.id, `withdrawal.${body.status}`, item.id)
        }); return empty(res)
      }
      if (method === 'GET' && path === '/api/community') {
        const account = auth.current(req)
        const visible = list('product').filter(product => isAdmin(account) || product.sellerId === account?.id || review(product.id).status === 'approved')
        return json(res, { tickets: account ? list('ticket', isAdmin(account) ? undefined : account.id) : [], reports: account ? list('report', isAdmin(account) ? undefined : account.id) : [],
          statuses: Object.fromEntries(visible.map(product => [product.id, review(product.id)])) })
      }
      if (method === 'POST' && path === '/api/support/tickets') {
        const account = auth.requireAccount(req); rateLimit(`ticket:${account.id}`, 10, 3600000)
        const subject = string(body.subject, 'subject', 3, 200), message = string(body.message, 'message', 10, 10000)
        if (body.orderId) requireValue(get('order', body.orderId)?.accountId === account.id, 'order')
        put('ticket', { id: id('tkt'), accountId: account.id, subject, message, orderId: body.orderId, status: 'open', createdAt: Date.now() }, account.id)
        return empty(res)
      }
      if (method === 'POST' && path === '/api/reports') {
        const account = auth.requireAccount(req); rateLimit(`report:${account.id}`, 20, 3600000)
        const product = get('product', string(body.productId, 'product', 1, 100)); requireValue(product, 'missing', 404)
        requireValue(['copyright', 'broken', 'misleading', 'other'].includes(body.reason), 'reason')
        put('report', { id: id('rpt'), productId: product.id, productName: product.name.zh, reporterId: account.id, reason: body.reason, detail: string(body.detail, 'detail', 0, 5000), status: 'open', createdAt: Date.now() }, account.id)
        return empty(res)
      }
      const adminMatch = path.match(/^\/api\/admin\/(tickets|reports|listings)\/([^/]+)$/)
      if (method === 'PATCH' && adminMatch) {
        const account = auth.requireAccount(req, 'admin'); const [, resource, target] = adminMatch
        if (resource === 'tickets') {
          const item = get('ticket', target); requireValue(item, 'missing', 404)
          put('ticket', { ...item, reply: string(body.reply, 'reply', 1, 10000), answeredAt: Date.now(), status: 'answered' }, item.accountId)
        } else if (resource === 'reports') {
          const item = get('report', target); requireValue(item, 'missing', 404); requireValue(body.status === 'resolved', 'status')
          put('report', { ...item, status: 'resolved' }, item.reporterId)
        } else {
          owner(account, target); requireValue(['pending', 'approved', 'rejected'].includes(body.status), 'status')
          requireValue(body.status !== 'approved' || hasFile(target) || db.prepare('SELECT 1 FROM draft_files WHERE product_id=?').get(target), 'missing-file', 409)
          const reason = string(body.reason ?? '', 'reason', body.status === 'rejected' ? 1 : 0, 1000)
          transaction(() => {
            if (body.status === 'approved') {
              const draft = db.prepare('SELECT * FROM draft_files WHERE product_id=?').get(target)
              if (draft) {
                db.prepare('INSERT INTO files VALUES(?,?,?) ON CONFLICT(product_id) DO UPDATE SET metadata=excluded.metadata,content=excluded.content').run(target, draft.metadata, draft.content)
                db.prepare('DELETE FROM draft_files WHERE product_id=?').run(target)
              }
            }
            put('review', { id: target, status: body.status, reason, at: Date.now() })
          })
        }
        audit(account.id, `${resource}.reviewed`, target); return empty(res)
      }
      if (method === 'GET' && path === '/api/files') {
        const account = auth.current(req)
        return json(res, db.prepare('SELECT product_id FROM files UNION SELECT product_id FROM draft_files').all().map(row => row.product_id).filter(productId => {
          const product = get('product', productId)
          return product && ((!product.archived && review(productId).status === 'approved') || isAdmin(account) || product.sellerId === account?.id || (account && entitled(account.id, productId)))
        }))
      }
      const fileMatch = path.match(/^\/api\/files\/([^/]+)(\/content)?$/)
      const downloadMatch = path.match(/^\/api\/downloads\/([^/]+)$/)
      if (fileMatch || downloadMatch) {
        const account = auth.requireAccount(req); const target = (fileMatch ?? downloadMatch)[1]
        const product = get('product', target); requireValue(product, 'missing', 404)
        const manages = isAdmin(account) || product.sellerId === account.id
        if (fileMatch && method === 'PUT' && !fileMatch[2]) {
          requireValue(manages, 'forbidden', 403)
          const raw = await readBody(req, config.maxFileBytes + 65536)
          const type = req.headers['content-type'] ?? ''
          requireValue(type.startsWith('multipart/form-data;'), 'content-type', 415)
          let form
          try { form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'Content-Type': type }, body: raw }).formData() } catch { throw new HttpError(400, 'file') }
          const file = form.get('file')
          requireValue(file && typeof file.arrayBuffer === 'function' && form.getAll('file').length === 1 && file.size > 0 && file.size <= config.maxFileBytes, 'file')
          const name = string(file.name, 'filename', 1, 180)
          requireValue(!/[\\/\x00-\x1f\x7f]/.test(name), 'filename')
          const content = Buffer.from(await file.arrayBuffer())
          const metadata = { productId: target, name, size: file.size, type: 'application/octet-stream', updatedAt: Date.now() }
          transaction(() => {
            db.prepare('INSERT INTO draft_files VALUES(?,?,?) ON CONFLICT(product_id) DO UPDATE SET metadata=excluded.metadata,content=excluded.content').run(target, JSON.stringify(metadata), content)
            put('review', { id: target, status: 'pending', at: Date.now() }); audit(account.id, 'file.uploaded', target)
          }); return json(res, metadata)
        }
        if (fileMatch && method === 'DELETE' && !fileMatch[2]) {
          requireValue(manages, 'forbidden', 403)
          requireValue(!db.prepare('SELECT 1 FROM entitlements WHERE product_id=?').get(target) && !list('order').some(order => order.status === 'pending' && order.lines.some(line => line.id === target)), 'file-in-use', 409)
          transaction(() => { db.prepare('DELETE FROM files WHERE product_id=?').run(target); db.prepare('DELETE FROM draft_files WHERE product_id=?').run(target); put('review', { id: target, status: 'pending', at: Date.now() }) }); return empty(res)
        }
        requireValue(manages || entitled(account.id, target), 'forbidden', 403)
        const draft = fileMatch && manages && (!fileMatch[2] || url.searchParams.get('draft') === '1') && db.prepare('SELECT metadata FROM draft_files WHERE product_id=?').get(target)
        requireValue(url.searchParams.get('draft') !== '1' || manages, 'forbidden', 403)
        const row = draft || db.prepare('SELECT metadata FROM files WHERE product_id=?').get(target); requireValue(row, 'missing', 404)
        const metadata = JSON.parse(row.metadata)
        // Re-check session and entitlement on the byte endpoint; no public file paths.
        if (downloadMatch && method === 'POST') return json(res, { url: `/api/files/${target}/content` })
        if (fileMatch && method === 'GET' && !fileMatch[2]) return json(res, { ...metadata, url: `/api/files/${target}/content${draft ? '?draft=1' : ''}` })
        if (fileMatch && method === 'GET' && fileMatch[2]) {
          const content = db.prepare(draft ? 'SELECT content FROM draft_files WHERE product_id=?' : 'SELECT content FROM files WHERE product_id=?').get(target).content
          res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': content.length, 'Content-Disposition': `attachment; filename="download.bin"; filename*=UTF-8''${encodeURIComponent(metadata.name).replace(/'/g, '%27')}` })
          return res.end(content)
        }
      }
      throw new HttpError(404, 'missing')
    } catch (error) {
      if (res.headersSent) { res.destroy(); return }
      const status = error instanceof HttpError ? error.status : 500
      if (status === 500) console.error('API failure:', error.message)
      if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter))
      json(res, { error: { code: error instanceof HttpError ? error.code : 'server', ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) } }, status)
    }
  })
  server.requestTimeout = 60000
  server.headersTimeout = 15000
  return { server, store, close: () => new Promise((resolve, reject) => server.close(error => { store.close(); error ? reject(error) : resolve() })) }
}
