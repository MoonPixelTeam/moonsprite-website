import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { cpSync } from 'node:fs'

/*
 * 官网是独立仓库，不加载、不启动应用仓库的任何东西。
 *
 * “在线体验”指向 SITE_CONFIG.trialUrl：部署后编辑器与官网同源，位于站点 /try/
 * 子目录；开发时由应用仓库的 `pnpm dev:web-trial` 单独跑在 5174，用环境变量
 * VITE_TRIAL_URL 覆盖即可。
 *
 * 这里保留一个早期的单端口方案说明，避免以后有人重复踩坑：曾让官网 dev server 用
 * createServer({ configFile: <应用仓库>/vite.config.ts }) 在中间件里挂载 /try/，
 * 但 Vite 8 的配置加载器解析不了仓库外的 Windows 绝对路径（盘符会被当成相对路径段，
 * 路径里的 "&" 也会被 URL 当成查询串），无论传绝对路径、file URL 还是配置对象都会失败。
 */
function trialLinks(): Plugin {
  return {
    name: 'moonsprite:website-trial-links',
    configureServer(server) {
      const trialUrl = process.env.VITE_TRIAL_URL || '/try/'
      server.config.logger.info(`[MoonSprite] Online trial link points to ${trialUrl}`)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), trialLinks(), {
    name: 'moonsprite:private-packages',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Do not expose legacy public package files when using the backend.
        const prototype = (process.env.VITE_API_BASE_URL ?? loadEnv(mode, process.cwd()).VITE_API_BASE_URL) === ''
        let path: string
        try { path = decodeURIComponent(req.url ?? '') } catch { res.statusCode = 400; res.end(); return }
        if (!prototype && /\.(mspet|msext|mspack|zip|7z|rar|lua)(?:[?#]|$)/i.test(path)) { res.statusCode = 404; res.end(); return }
        next()
      })
    },
  }, {
    name: 'moonsprite:private-build-assets',
    apply: 'build',
    closeBundle() {
      // Built artifacts must not contain downloadable products, even on a static host.
      cpSync(resolve('public'), resolve('dist'), { recursive: true, filter: source => !/\.(mspet|msext|mspack|zip|7z|rar|lua)$/i.test(source) })
    },
  }],
  // 编辑器独立跑在 127.0.0.1:5174 时，官网会从这个主机名加载其资源。
  server: {
    allowedHosts: ['127.0.0.1', 'localhost'],
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/data/**', `${resolve(process.env.DATA_DIR || loadEnv(mode, process.cwd(), '').DATA_DIR || 'server/data').replaceAll('\\', '/')}/**`] },
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.PORT || loadEnv(mode, process.cwd(), '').PORT || 3001}` } },
  },
  build: {
    copyPublicDir: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
}))
