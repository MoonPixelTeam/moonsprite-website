export const SITE_CONFIG = {
  githubUrl: 'https://github.com/MoonPixelTeam/moonsprite',
  communityUrl: 'https://moonpx.art/',
  steamUrl: 'https://store.steampowered.com/search/?term=MoonSprite',
  /*
   * The store and account backend. Empty means the site runs on the local prototype
   * adapter: real flows, but every account and order lives in this browser only. Point
   * this at a server and src/api switches to the HTTP adapter automatically.
   */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '/api').trim(),
  footerLinks: {
    github: 'https://github.com/MoonPixelTeam/moonsprite',
    issues: 'https://github.com/MoonPixelTeam/moonsprite/issues',
    discussions: 'https://github.com/MoonPixelTeam/moonsprite/discussions',
    steam: 'https://store.steampowered.com/search/?term=MoonSprite',
    /* Steam 商店页地址。可留空：页脚会把这一项渲染成不可点的“待上线”状态。 */
    steamStore: 'https://store.steampowered.com/search/?term=MoonSprite',
    x: '',
    xiaohongshu: '',
    bilibili: '',
    heybox: '',
    docs: '#/docs',
    ui: '#/ui',
    faq: '#/faq',
    support: '#/docs/support',
    blog: '#/blog',
    changelog: 'https://github.com/MoonPixelTeam/moonsprite/blob/main/CHANGELOG.md',
    team: 'https://github.com/MoonPixelTeam',
    privacy: '#/privacy',
  },
} as const
