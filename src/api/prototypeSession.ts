/** Browser-only demo gates. Never use these as backend authorization. */
const STUDIO_SESSION = 'moonsprite-studio-session'
export const STUDIO_PASSPHRASE = 'studio'

export function readStudioUnlocked(accountId?: string): boolean {
  try {
    const raw = localStorage.getItem(STUDIO_SESSION)
    if (!raw) return false
    if (raw === '1') return false
    const session = JSON.parse(raw) as { accountId?: string }
    return Boolean(accountId && session.accountId === accountId)
  } catch {
    return false
  }
}

export function writeStudioUnlocked(value: boolean, accountId?: string): void {
  try {
    if (value && accountId) localStorage.setItem(STUDIO_SESSION, JSON.stringify({ accountId }))
    else localStorage.removeItem(STUDIO_SESSION)
  } catch (error) {
    console.warn('MoonSprite api: could not persist the studio session.', error)
  }
}

/** Orders changed somewhere in this tab. */
export function notifyOrdersChanged(): void {
  window.dispatchEvent(new Event('moonsprite:data'))
}
