import { configuration } from './config.mjs'
import { createApplication } from './app.mjs'
import { serveStatic } from './static.mjs'

const config = configuration()
const app = createApplication(config, { serveAsset: serveStatic('dist') })
app.server.listen(config.port, config.host, () => {
  console.log(`MoonSprite API: http://${config.host}:${config.port}/api (site ${config.publicOrigin})`)
  if (!config.production && !config.smtpUrl) console.log(`Development email inbox: ${config.dataDir}/mail`)
})
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close().then(() => process.exit(0)) })
