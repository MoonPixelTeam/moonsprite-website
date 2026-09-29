import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

test('HTTP contract preserves errors, rejects failed writes, and sends only authoritative order references', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom' })
  const previousFetch = globalThis.fetch
  try {
    const { httpAdapter: api } = await server.ssrLoadModule('/src/api/http.ts')
    const { request } = await server.ssrLoadModule('/src/api/transport.ts')
    let captured
    globalThis.fetch = async (url, options) => { captured = { url, options }; return new Response(JSON.stringify({ id: 'order', lines: [], total: 0, createdAt: 0 }), { status: 200 }) }
    assert.equal((await api.orders.create([{ id: 'pet', quantity: 1, price: 0.01, name: 'tampered', platformFeePercent: 0 }])).ok, true)
    assert.deepEqual(JSON.parse(captured.options.body), { lines: [{ id: 'pet', quantity: 1 }] })
    assert.equal(captured.options.credentials, 'include')
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'forbidden' } }), { status: 403 })
    await assert.rejects(api.auth.signOut(), /forbidden/)
    await assert.rejects(api.auth.deleteAccount(), /forbidden/)
    await assert.rejects(api.studio.unpublish('x'), /forbidden/)
    await assert.rejects(api.auth.requestPasswordReset('a@b.com'), /forbidden/)
    assert.deepEqual(await api.auth.register({ name: 'A', email: 'a@b.com', password: 'test' }), { ok: false, error: 'forbidden' })
    globalThis.fetch = async () => new Response(null, { status: 204 })
    assert.equal(await api.auth.signOut(), undefined)
    assert.deepEqual(await api.auth.requestPasswordReset('a@b.com'), { ok: true, exists: false })
    globalThis.fetch = async () => new Response('broken', { status: 200 })
    await assert.rejects(request('/catalogue'), /invalid-response/)
    globalThis.fetch = async () => { throw new Error('offline') }
    assert.deepEqual(await api.orders.create([]), { ok: false, error: 'network' })
  } finally { globalThis.fetch = previousFetch; await server.close() }
})
