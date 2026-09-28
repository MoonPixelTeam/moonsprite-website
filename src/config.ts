export const SITE_CONFIG = {
  githubUrl: 'https://github.com/MoonPixelTeam/moonsprite',
  communityUrl: 'https://moonpx.art/',
  steamUrl: '',
  /*
   * The store and account backend. Empty means the site runs on the local prototype
   * adapter: real flows, but every account and order lives in this browser only. Point
   * this at a server and src/api switches to the HTTP adapter automatically.
   */
  apiBaseUrl: '',
  footerLinks: {
    github: 'https://github.com/MoonPixelTeam/moonsprite',
    issues: 'https://github.com/MoonPixelTeam/moonsprite/issues',
    discussions: 'https://github.com/MoonPixelTeam/moonsprite/discussions',
    steam: '',
    /* Steam 商店页地址。可留空：页脚会把这一项渲染成不可点的“待上线”状态。 */
    steamStore: '',
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
