/** Development-only proxy; never included in the production server. */
export function developmentApiProxy(env) {
  const remote = env.DEV_API_TARGET
  const target = remote ? new URL(remote) : new URL(`http://127.0.0.1:${env.PORT || 3001}`)
  if (remote && target.protocol !== 'https:') throw new Error('DEV_API_TARGET must use HTTPS')
  return {
    target: target.origin,
    changeOrigin: Boolean(remote),
    ...(remote ? {
      cookieDomainRewrite: '',
      configure(proxy) {
        proxy.on('proxyReq', (outgoing, incoming) => {
          // Rewrite only requests originating from this local development host.
          const origin = incoming.headers.origin
          if (origin && origin === `http://${incoming.headers.host}`) outgoing.setHeader('origin', target.origin)
        })
        proxy.on('proxyRes', response => {
          // Browser talks HTTP to localhost; upstream remains verified HTTPS.
          const cookies = response.headers['set-cookie']
          if (cookies) response.headers['set-cookie'] = cookies.map(cookie => cookie.replace(/;\s*Secure\b/gi, ''))
        })
      },
    } : {}),
  }
}
