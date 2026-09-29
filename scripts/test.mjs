import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'

// Existing UI tests intentionally exercise the browser-only prototype.
const files = (await readdir('scripts')).filter(name => name.endsWith('.test.mjs')).map(name => `scripts/${name}`)
const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...files], { stdio: 'inherit', env: { ...process.env, VITE_API_BASE_URL: '' } })
child.on('exit', code => { process.exitCode = code ?? 1 })
