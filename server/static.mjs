import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' }
export function serveStatic(directory) {
  const root = resolve(directory)
  return async (req, res) => {
    const fail = status => { res.writeHead(status); res.end() }
    if (!['GET', 'HEAD'].includes(req.method)) return fail(405)
    let path
    try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) } catch { return fail(400) }
    const targetPath = path === '/' || path.endsWith('/') ? `${path}index.html` : path
    const target = resolve(root, '.' + targetPath)
    if (!target.startsWith(root + sep) || !types[extname(target)] || path.split('/').some(part => part.startsWith('.'))) return fail(404)
    // Only presentation assets are public. Archives/packages are always private API downloads.
    let file
    try { file = await stat(target) } catch { return fail(404) }
    if (!file.isFile()) return fail(404)
    const headers = { 'Content-Type': types[extname(target)], 'Accept-Ranges': 'bytes', 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache' }
    let start = 0, end = file.size - 1, status = 200
    if (req.headers.range) {
      const range = req.headers.range.match(/^bytes=(\d*)-(\d*)$/)
      if (!range || (!range[1] && !range[2])) return fail(416)
      start = range[1] ? Number(range[1]) : Math.max(0, file.size - Number(range[2]))
      end = range[1] && range[2] ? Math.min(Number(range[2]), file.size - 1) : file.size - 1
      if (start > end || start >= file.size) return fail(416)
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${file.size}`
    }
    res.writeHead(status, { ...headers, 'Content-Length': Math.max(0, end - start + 1) })
    if (req.method === 'HEAD' || file.size === 0) return res.end()
    createReadStream(target, { start, end }).on('error', () => res.destroy()).pipe(res)
  }
}
