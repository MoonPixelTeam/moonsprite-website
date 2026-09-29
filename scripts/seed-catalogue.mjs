import { createServer, loadEnv } from 'vite'
import { readFile } from 'node:fs/promises'
import { resolve, sep, basename } from 'node:path'
import { configuration } from '../server/config.mjs'
import { openDatabase } from '../server/database.mjs'
import { email, requireValue } from '../server/validation.mjs'

const config = configuration({ ...loadEnv('development', process.cwd(), ''), ...process.env })
const store = openDatabase(config.database)
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const row = store.db.prepare('SELECT data FROM accounts WHERE email=?').get(email(process.argv[2]))
  requireValue(row, 'Create a seller/admin account first')
  const account = JSON.parse(row.data)
  requireValue(account.roles.some(role => ['creator', 'admin'].includes(role)), 'Creator role required')
  const { MARKET_PRODUCTS } = await vite.ssrLoadModule('/src/market/catalog.ts')
  let added = 0, skipped = 0
  for (const item of MARKET_PRODUCTS) {
    if (!item.download || store.get('product', item.id)) { skipped++; continue }
    const root = resolve('public'), file = resolve(root, '.' + item.download)
    requireValue(file.startsWith(root + sep), 'Invalid source path')
    let content
    try { content = await readFile(file) } catch { console.log(`Skipped missing file: ${item.id}`); skipped++; continue }
    const { download, members, pack, ...fields } = item
    const product = { ...fields, size: item.size.zh, tags: item.tags ?? [], sellerId: account.id, publishedAt: Date.now(), updatedAt: Date.now(), archived: false }
    store.transaction(() => {
      store.put('product', product, account.id)
      store.db.prepare('INSERT INTO files VALUES(?,?,?)').run(product.id, JSON.stringify({ productId: product.id, name: basename(file), type: 'application/octet-stream', size: content.length, updatedAt: Date.now() }), content)
      store.put('review', { id: product.id, status: 'approved', at: Date.now() })
      store.audit('cli', 'catalogue.imported', product.id)
    }); added++
  }
  console.log(`Imported ${added} products with real files; skipped ${skipped}. Existing records were preserved.`)
} finally { await vite.close(); store.close() }
