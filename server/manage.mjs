import { roleGroups } from './roles.mjs'
import { randomUUID } from 'node:crypto'
import { configuration } from './config.mjs'
import { openDatabase } from './database.mjs'
import { hashPassword } from './auth.mjs'
import { email, password, requireValue } from './validation.mjs'

const [command, addressInput, role] = process.argv.slice(2)
const config = configuration()
const store = openDatabase(config.database)
try {
  const address = email(addressInput)
  if (command === 'create-admin') {
    requireValue(!store.db.prepare('SELECT 1 FROM accounts WHERE email=?').get(address), 'exists', 409)
    const hash = await hashPassword(password(process.env.ADMIN_PASSWORD))
    const account = { id: `usr_${randomUUID()}`, name: 'MoonSprite Admin', email: address, roles: ['buyer', 'creator', 'admin'], emailVerified: false, createdAt: Date.now() }
    store.db.prepare('INSERT INTO accounts VALUES(?,?,?,?)').run(account.id, address, hash, JSON.stringify(account))
    store.audit('cli', 'admin.created', account.id)
    console.log(`Administrator created: ${address}`)
  } else if (command === 'set-role') {
    requireValue(['buyer', 'creator', 'admin'].includes(role), 'role')
    const row = store.db.prepare('SELECT data FROM accounts WHERE email=?').get(address); requireValue(row, 'missing', 404)
    const account = JSON.parse(row.data)
    account.roles = roleGroups[role]
    store.db.prepare('UPDATE accounts SET data=? WHERE id=?').run(JSON.stringify(account), account.id)
    store.db.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id)
    store.audit('cli', 'role.changed', account.id)
    console.log(`Role updated to ${role}; user must sign in again.`)
  } else throw new Error('Usage: pnpm manage create-admin email | pnpm manage set-role email buyer|creator|admin; set ADMIN_PASSWORD in environment for creation')
} finally { store.close() }
