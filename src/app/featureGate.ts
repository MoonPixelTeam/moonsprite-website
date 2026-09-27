/*
 * Production gate for the prototype areas of the site.
 *
 * The store, the cart, the competitions page and the account area are still local
 * prototypes, so on the live site their header entries answer with a "still in
 * development" notice instead of opening a screen that only pretends to work.
 *
 * Three ways to open them while developing:
 *
 *   1. `pnpm dev`   — Vite development builds default to open, no switch needed.
 *   2. `pnpm build` — production builds default to locked; set VITE_FEATURES=open to
 *                      build an unlocked bundle.
 *   3. On a deployed site — open the site with `?features=open` once, or run
 *                      `localStorage.setItem('moonsprite.features', 'open')` in the
 *                      browser console. The choice is remembered on that browser only,
 *                      so visitors keep seeing the development notice.
 *
 * `?features=locked` turns them back off on a development build.
 */
import { useEffect, useState } from 'react'

export type SiteFeature = 'account' | 'cart' | 'market' | 'competitions'

const STORAGE_KEY = 'moonsprite.features'
const CHANGE_EVENT = 'moonsprite:features'

function readChoice(): boolean | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'open' ? true : value === 'locked' ? false : null
  } catch {
    /* Private mode and blocked storage: the build default still applies. */
    return null
  }
}

function writeChoice(open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? 'open' : 'locked')
  } catch {
    /* Nothing to persist; this visit still follows the parameter. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Resolution order: URL parameter, stored choice, build default. */
function resolveOpen(): boolean {
  if (typeof window === 'undefined') return true
  const params = new URLSearchParams(`${window.location.search}&${window.location.hash.split('?')[1] ?? ''}`)
  const requested = params.get('features')
  if (requested === 'open') {
    writeChoice(true)
    return true
  }
  if (requested === 'locked') {
    writeChoice(false)
    return false
  }
  const stored = readChoice()
  if (stored !== null) return stored
  return import.meta.env.VITE_FEATURES === 'open' || import.meta.env.DEV
}

let open = resolveOpen()

/** True while the prototype areas answer with the development notice. */
export function siteFeaturesLocked(): boolean {
  return !open
}

/** Open or lock the prototype areas and remember the choice on this browser. */
export function setSiteFeatures(locked: boolean): void {
  open = !locked
  writeChoice(open)
}

/**
 * The gate state for one header entry. Returns the notice to raise when the entry is
 * pressed, or null when the entry is live and should navigate as usual.
 */
export function useUnavailableNotice(feature: SiteFeature): (() => void) | null {
  const [locked, setLocked] = useState(() => siteFeaturesLocked())
  useEffect(() => {
    const sync = () => setLocked(siteFeaturesLocked())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  if (!locked) return null
  return () => notifyUnavailable(feature)
}

export type UnavailableNotice = { key: number; feature: SiteFeature }

let notice: UnavailableNotice | null = null
let sequence = 0
const listeners = new Set<(value: UnavailableNotice | null) => void>()

/** Show the "still in development" notice for one feature. */
export function notifyUnavailable(feature: SiteFeature): void {
  notice = { key: (sequence += 1), feature }
  for (const listener of listeners) listener(notice)
}

export function dismissUnavailable(): void {
  notice = null
  for (const listener of listeners) listener(notice)
}

/*
 * The host subscribes on mount. A notice is always raised by a click, and clicks only
 * happen once the host is mounted, so nothing is lost while it is absent.
 */
export function useUnavailableNoticeState(): UnavailableNotice | null {
  const [value, setValue] = useState<UnavailableNotice | null>(notice)
  useEffect(() => {
    listeners.add(setValue)
    setValue(notice)
    return () => { listeners.delete(setValue) }
  }, [])
  return value
}
