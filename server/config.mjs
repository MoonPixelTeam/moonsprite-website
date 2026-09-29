import { resolve } from 'node:path'

export function configuration(env = process.env) {
  const production = env.NODE_ENV === 'production'
  const publicOrigin = new URL(env.PUBLIC_ORIGIN || 'http://localhost:5173').origin
  if (production && (!env.PUBLIC_ORIGIN || !publicOrigin.startsWith('https://') || !env.SMTP_URL || !env.MAIL_FROM)) {
    throw new Error('Production requires HTTPS PUBLIC_ORIGIN, SMTP_URL and MAIL_FROM')
  }
  if (Boolean(env.ZPAY_PID) !== Boolean(env.ZPAY_KEY)) throw new Error('Configure both ZPAY_PID and ZPAY_KEY')
  const dataDir = resolve(env.DATA_DIR || 'server/data')
  return {
    production, publicOrigin, secureCookies: publicOrigin.startsWith('https://'),
    dataDir, database: resolve(dataDir, 'moonsprite.sqlite'),
    port: Number(env.PORT || 3001), host: env.HOST || '127.0.0.1',
    trustProxy: env.TRUST_PROXY === '1',
    smtpUrl: env.SMTP_URL, mailFrom: env.MAIL_FROM || 'MoonSprite <noreply@localhost>',
    zpayPid: env.ZPAY_PID || '', zpayKey: env.ZPAY_KEY || '', zpayCid: env.ZPAY_CID || '',
    zpaySubmitUrl: 'https://zpayz.cn/submit.php',
    // Existing catalogue uses USD. ZPAY charges CNY; lock the rate into each order.
    usdToCny: 7.2,
    maxFileBytes: 50 * 1024 * 1024,
  }
}
