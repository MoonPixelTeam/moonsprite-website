import { createServer, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  plugins: [react(), trialLinks()],
  // 编辑器独立跑在 127.0.0.1:5174 时，官网会从这个主机名加载其资源。
  server: {
    allowedHosts: ['127.0.0.1', 'localhost'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})