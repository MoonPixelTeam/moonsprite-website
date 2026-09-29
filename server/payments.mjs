import { createHash, timingSafeEqual } from 'node:crypto'
import { HttpError, requireValue } from './validation.mjs'

// ZPAY's published protocol: https://z-pay.cn/doc.html (2026-09-30).
export function signZpay(parameters, key) {
  const plain = Object.keys(parameters).sort().filter(name => !['sign', 'sign_type'].includes(name) && parameters[name] !== '' && parameters[name] != null)
    .map(name => `${name}=${parameters[name]}`).join('&')
  return createHash('md5').update(plain + key).digest('hex')
}
export function verifyZpay(parameters, key) {
  if (!key || !/^[a-f0-9]{32}$/.test(parameters.sign ?? '') || parameters.sign_type !== 'MD5') return false
  return timingSafeEqual(Buffer.from(signZpay(parameters, key)), Buffer.from(parameters.sign))
}
export function paymentParameters(order, config) {
  requireValue(config.zpayPid && config.zpayKey, 'payment-unavailable', 503)
  const parameters = {
    pid: config.zpayPid, type: order.paymentType, out_trade_no: order.id,
    name: order.lines.map(line => line.name).join('、').slice(0, 100),
    money: (order.cnyCents / 100).toFixed(2),
    notify_url: `${config.publicOrigin}/api/payments/zpay/notify`,
    return_url: `${config.publicOrigin}/api/payments/zpay/return`,
  }
  if (config.zpayCid) parameters.cid = config.zpayCid
  return { ...parameters, sign: signZpay(parameters, config.zpayKey), sign_type: 'MD5' }
}
export function notificationAmount(value) {
  requireValue(typeof value === 'string' && /^\d{1,10}(\.\d{1,2})?$/.test(value), 'payment-amount')
  const [whole, decimal = ''] = value.split('.')
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
}

export async function queryZpay(order, config) {
  const url = new URL('https://zpayz.cn/api.php')
  url.search = new URLSearchParams({ act: 'order', pid: config.zpayPid, key: config.zpayKey, out_trade_no: order.id }).toString()
  // The vendor requires credentials in this server-to-server URL. Never log it.
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' })
    if (!response.ok) throw new Error('provider')
    const value = await response.json()
    requireValue(Number(value.code) === 1, 'payment-query', 502)
    return value
  } catch { throw new HttpError(502, 'payment-query') }
}
