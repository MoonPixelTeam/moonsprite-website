import { useEffect } from 'react'
import type { Copy } from '../content'
import { PixelX } from '../ui/icons'
import { dismissUnavailable, useUnavailableNoticeState } from './featureGate'

/**
 * Bottom-right notice that answers the gated header entries. One notice at a time: a
 * second press replaces the first instead of stacking, and it clears itself after a few
 * seconds so nothing has to be dismissed by hand.
 */
export function FeatureNoticeHost({ t, timeout = 6000 }: { t: Copy; timeout?: number }) {
  const notice = useUnavailableNoticeState()
  const key = notice?.key

  useEffect(() => {
    if (key === undefined) return
    const timer = window.setTimeout(dismissUnavailable, timeout)
    return () => window.clearTimeout(timer)
  }, [key, timeout])

  if (!notice) return null

  return <div className="feature-notice-layer" role="presentation">
    <div className="feature-notice" role="status" aria-live="polite">
      <span className="feature-notice-mark" aria-hidden="true" />
      <div className="feature-notice-body">
        <p className="feature-notice-text">
          <span className="feature-notice-label">{t.unavailable.label}</span>
          {t.unavailable.features[notice.feature]}
        </p>
        <p className="feature-notice-message">{t.unavailable.message}</p>
      </div>
      <button type="button" className="feature-notice-dismiss" onClick={dismissUnavailable} aria-label={t.unavailable.dismiss}>
        <PixelX />
      </button>
    </div>
  </div>
}
