import { createServer, loadEnv } from 'vite'
import { configuration } from '../server/config.mjs'
import { createApplication } from '../server/app.mjs'

const args = process.argv.slice(2)
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
const host = option('--host', 'localhost')
const port = Number(option('--port', '5173'))
env.PUBLIC_ORIGIN = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`
const config = env.DEV_API_TARGET ? null : configuration(env)
const app = config ? createApplication(config) : null
const vite = await createServer({ server: { host, port, strictPort: true } })
try {
  if (app) await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(config.port, config.host, resolve) })
  await vite.listen(); vite.printUrls()
  if (env.DEV_API_TARGET) console.log('Using LIVE backend: ' + env.DEV_API_TARGET + ' — changes affect live data')
  if (config) console.log(`Backend ready on port ${config.port}; development email inbox: ${config.dataDir}/mail`)
} catch (error) { await vite.close(); await app?.close().catch(() => {}); throw error }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void Promise.all([vite.close(), app?.close()]).then(() => process.exit(0)) })
