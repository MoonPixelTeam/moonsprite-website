import { ActionButton } from '../ui'
import { useEffect } from 'react'
import { scrollToId } from '../ui'
import { PixelMenu as Menu, PixelX as X, PixelCart, PixelUserSignedOut, PixelUserSignedIn, PixelSun, PixelMoon, PixelLanguage } from '../ui/icons'
import { navigate } from '../router'
import type { Route } from '../router'
import type { Copy } from '../content'
import type { useSitePreferences } from './useSitePreferences'
import { useAccount } from '../account/store'
import { useCartStore } from '../market/cart'
import { IconButton } from '../ui'
import { SITE_CONFIG } from '../config'
import { useUnavailableNotice } from './featureGate'
import type { MouseEvent as ReactMouseEvent } from 'react'

export function SiteNavigation({ preferences, route, t }: { preferences: ReturnType<typeof useSitePreferences>; route: Route; t: Copy }) {
  const { language, setLanguage, theme, setTheme, menuOpen, setMenuOpen, langOpen, setLangOpen, langMenuRef } = preferences
  const { cart, openCart, hasOpener } = useCartStore()
  const { account } = useAccount()
  /*
   * 商店、购物车、比赛与账户仍是本地原型，正式站上这四个入口只给“开发中”提示。
   * 三个闸门各自独立取值，因此开发站可以只锁一部分。
   */
  const accountGated = useUnavailableNotice('account')
  const cartGated = useUnavailableNotice('cart')
  const marketGated = useUnavailableNotice('market')
  const competitionsGated = useUnavailableNotice('competitions')
  useEffect(() => {
    setMenuOpen(false)
    setLangOpen(false)
  }, [route.page, route.subId, setMenuOpen, setLangOpen])
  useEffect(() => {
    if (!menuOpen && !langOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      setLangOpen(false)
      document.querySelector<HTMLButtonElement>(menuOpen ? '.menu-button' : '.language-button')?.focus()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen, langOpen, setMenuOpen, setLangOpen])


  /*
   * The header shows the cart on every route, but only the market and pack pages own a
   * drawer. Off those pages the button brings the market up and opens the drawer once it
   * has mounted, so the button always does what it looks like it does.
   */
  const openCartFromHeader = () => {
    if (hasOpener) {
      openCart()
      return
    }
    navigate('#/market')
    window.setTimeout(openCart, 120)
  }

  

  const closeMenu = () => setMenuOpen(false)
  /** 被锁入口统一走这里：关掉菜单，弹出“开发中”提示，不改动地址。 */
  const gatedPress = (notice: () => void) => (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    notice()
    closeMenu()
  }
  const goSection = (id: string) => {
    closeMenu()
    if (route.page === 'home') {
      scrollToId(id)
      return
    }
    navigate('#/')
    setTimeout(() => scrollToId(id), 90)
  }
  const goHome = () => {
    closeMenu()
    navigate('#/')
  }

  const navLinks = <>
    <a href="/try/" onClick={closeMenu} target="_blank" rel="noopener noreferrer">{language === 'zh' ? '在线体验' : 'Try online'}</a>
    <a href="#/" onClick={(event) => { event.preventDefault(); goSection('features') }}>{t.nav.features}</a>
    <a
      href="#/competitions"
      onClick={competitionsGated ? gatedPress(competitionsGated) : closeMenu}
      aria-current={route.page === 'competitions' ? 'page' : undefined}
      data-gated={competitionsGated ? '' : undefined}
    >{language === 'zh' ? '比赛' : 'Competitions'}</a>
    <a
      href="#/market"
      onClick={marketGated ? gatedPress(marketGated) : closeMenu}
      aria-current={route.page === 'market' ? 'page' : undefined}
      data-gated={marketGated ? '' : undefined}
    >{t.nav.market}</a>
    <a href="#/docs" onClick={closeMenu} aria-current={route.page === 'docs' ? 'page' : undefined}>{t.nav.docs}</a>
    <a href="#/faq" onClick={closeMenu} aria-current={route.page === 'faq' ? 'page' : undefined}>{t.nav.faq}</a>
    <a href={SITE_CONFIG.communityUrl} onClick={closeMenu} target="_blank" rel="noopener noreferrer">{t.nav.community}</a>
    <a href={SITE_CONFIG.githubUrl} onClick={closeMenu} target="_blank" rel="noopener noreferrer">GitHub</a>
  </>

  return (
    <header className="app-chrome">
      <div className="titlebar">
        <a className="titlebar-app" href="#/" aria-label="MoonSprite" onClick={(event) => { event.preventDefault(); goHome() }}>
          <img className="titlebar-wordmark" src="/assets/moonsprite-wordmark.png" alt="" width="172" height="26" />
        </a>

      </div>
      <div className="menubar">
        <nav className={menuOpen ? 'menubar-tabs open' : 'menubar-tabs'} id="site-navigation" aria-label={language === 'zh' ? '主导航' : 'Primary navigation'}>{navLinks}</nav>
        <div className="menubar-utils">
          <span className="cart-slot">
            <IconButton className="cart-button-icon" label={language === 'zh' ? '购物车' : 'Cart'} onClick={cartGated ?? openCartFromHeader} icon={<PixelCart />} />
            {!cartGated && cart.count > 0 && <span className="cart-badge">{cart.count}</span>}
          </span>
          <IconButton
            className="account-button"
            label={accountGated || !account ? t.accountPage.title : `${t.accountPage.signedInAs}: ${account.name}`}
            href={accountGated ? undefined : account ? '#/account' : '#/login'}
            onClick={accountGated ?? closeMenu}
            aria-current={route.page === 'account' ? 'page' : undefined}
            icon={accountGated || !account ? <PixelUserSignedOut /> : <PixelUserSignedIn />} />
          <IconButton label={theme === 'dark' ? t.common.themeToLight : t.common.themeToDark} onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} icon={theme === 'dark' ? <PixelSun /> : <PixelMoon />} />
          <div className="lang-menu" ref={langMenuRef}>
            <IconButton className="language-button" label={language === 'zh' ? '切换语言' : 'Change language'} onClick={() => setLangOpen((value) => !value)} aria-haspopup="listbox" aria-expanded={langOpen} icon={<PixelLanguage />} />
            {langOpen && <ul className="lang-options" role="listbox" aria-label="Language">
              <li><ActionButton type="button" role="option" aria-selected={language === 'zh'} onClick={() => { setLanguage('zh'); setLangOpen(false) }}>中文</ActionButton></li>
              <li><ActionButton type="button" role="option" aria-selected={language === 'en'} onClick={() => { setLanguage('en'); setLangOpen(false) }}>English</ActionButton></li>
            </ul>}
          </div>
          <IconButton className="menu-button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="site-navigation" label={menuOpen ? t.nav.close : t.nav.menu} icon={menuOpen ? <X /> : <Menu />} />
        </div>
      </div>
    </header>
  )
}
