import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password TEXT NOT NULL, data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tokens (
      token TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, email TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      kind TEXT NOT NULL, id TEXT NOT NULL, owner TEXT NOT NULL, data TEXT NOT NULL,
      PRIMARY KEY(kind, id)
    );
    CREATE INDEX IF NOT EXISTS records_owner ON records(kind, owner);
    CREATE TABLE IF NOT EXISTS files (
      product_id TEXT PRIMARY KEY, metadata TEXT NOT NULL, content BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS draft_files (
      product_id TEXT PRIMARY KEY, metadata TEXT NOT NULL, content BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entitlements (
      account_id TEXT NOT NULL, product_id TEXT NOT NULL, order_id TEXT NOT NULL,
      PRIMARY KEY(account_id, product_id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor TEXT NOT NULL,
      action TEXT NOT NULL, target TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    PRAGMA user_version=1;
  `)
  const get = (kind, id) => {
    const row = db.prepare('SELECT data FROM records WHERE kind=? AND id=?').get(kind, id)
    return row ? JSON.parse(row.data) : undefined
  }
  const list = (kind, owner) => (owner === undefined
    ? db.prepare('SELECT data FROM records WHERE kind=? ORDER BY rowid DESC').all(kind)
    : db.prepare('SELECT data FROM records WHERE kind=? AND owner=? ORDER BY rowid DESC').all(kind, owner)
  ).map(row => JSON.parse(row.data))
  const put = (kind, data, owner = '') => {
    db.prepare('INSERT INTO records(kind,id,owner,data) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET owner=excluded.owner,data=excluded.data')
      .run(kind, data.id, owner, JSON.stringify(data))
    return data
  }
  const transaction = work => {
    db.exec('BEGIN IMMEDIATE')
    try { const result = work(); db.exec('COMMIT'); return result }
    catch (error) { db.exec('ROLLBACK'); throw error }
  }
  const audit = (actor, action, target) => db.prepare('INSERT INTO events(at,actor,action,target) VALUES(?,?,?,?)').run(Date.now(), actor, action, target)
  return { db, get, list, put, transaction, audit, close: () => db.close() }
}
