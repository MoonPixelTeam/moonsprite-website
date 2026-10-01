import { hasRole } from './roles.mjs'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { requireValue } from './validation.mjs'

const scrypt = promisify(scryptCallback)
export const hashToken = token => createHash('sha256').update(token).digest('hex')
export const randomToken = () => randomBytes(32).toString('hex')
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${Buffer.from(await scrypt(password, salt, 64)).toString('hex')}`
}
export async function checkPassword(password, stored) {
  const [salt, hash] = (stored ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':')
  const actual = Buffer.from(await scrypt(password, salt, 64))
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'))
}
export function authentication(store, config) {
  const { db } = store
  const cookieName = 'moonsprite_session'
  const cookie = (value, age) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${config.secureCookies ? '; Secure' : ''}`
  const tokenFrom = req => (req.headers.cookie ?? '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1) ?? ''
  const current = req => {
    const row = db.prepare('SELECT accounts.data FROM sessions JOIN accounts ON accounts.id=sessions.account_id WHERE token=? AND expires>?').get(hashToken(tokenFrom(req)), Date.now())
    return row ? JSON.parse(row.data) : null
  }
  const start = (req, res, account) => {
    db.prepare('DELETE FROM sessions WHERE token=? OR expires<=?').run(hashToken(tokenFrom(req)), Date.now())
    const token = randomToken()
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hashToken(token), account.id, Date.now() + 7 * 86400000)
    res.setHeader('Set-Cookie', cookie(token, 7 * 86400))
  }
  const end = (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token=?').run(hashToken(tokenFrom(req)))
    res.setHeader('Set-Cookie', cookie('', 0))
  }
  const requireAccount = (req, role) => {
    const account = current(req)
    requireValue(account, 'unauthenticated', 401)
    requireValue(!role || hasRole(account, role), 'forbidden', 403)
    return account
  }
  return { current, start, end, requireAccount }
}
