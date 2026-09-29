import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export function createMailer(config) {
  return async message => {
    if (config.smtpUrl) {
      const { default: nodemailer } = await import('nodemailer')
      const transport = nodemailer.createTransport(config.smtpUrl, { from: config.mailFrom })
      await transport.sendMail(message)
      return
    }
    if (config.production) throw new Error('SMTP_URL is required in production')
    // Development mailbox is private, never exposed by the HTTP server.
    const directory = join(config.dataDir, 'mail')
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify(message, null, 2), { mode: 0o600 })
  }
}
