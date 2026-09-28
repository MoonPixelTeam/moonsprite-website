import { Button } from '../ui'
import { navigate } from '../router'
import type { Copy, Language } from '../content'
import type { SiteFeature } from '../app/featureGate'

/**
 * Shown in place of a screen that is still a local prototype. The address is left alone:
 * redirecting would hide what happened, and someone opening a shared link deserves to be
 * told why the page is missing rather than landing somewhere unrelated.
 */
export function UnavailablePage({ feature, t, language }: { feature: SiteFeature; t: Copy; language: Language }) {
  const zh = language === 'zh'
  return <main id="main" className="unavailable-page">
    <div className="content-wrap">
      <section className="unavailable-card">
        <p className="unavailable-eyebrow">{t.unavailable.label}</p>
        <h1>{t.unavailable.features[feature]}</h1>
        <p className="unavailable-message">{t.unavailable.message}</p>
        <p className="unavailable-hint">{zh
          ? '这个页面还在开发中，暂时没有可以打开的内容。上线后会在这里公布。'
          : 'This page is still in development. There is nothing to open here yet; we will announce it when it ships.'}</p>
        <div className="unavailable-actions">
          <Button variant="primary" href="#/" onClick={() => navigate('#/')}>{t.unavailable.backHome}</Button>
        </div>
      </section>
    </div>
  </main>
}
