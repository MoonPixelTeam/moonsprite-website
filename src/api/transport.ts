import { SITE_CONFIG } from '../config'

export class ApiError extends Error {
  constructor(public code: string, public status = 0, public retryAfter = 0) { super(code); this.name = 'ApiError' }
}
export type RequestOptions = { method?: string; body?: unknown; signal?: AbortSignal }
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const timeout = AbortSignal.timeout(15_000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
  let response: Response
  try {
    response = await fetch(SITE_CONFIG.apiBaseUrl.replace(/\/$/, '') + path, {
      method: options.method ?? 'GET', credentials: 'include',
      headers: options.body === undefined || options.body instanceof FormData ? { Accept: 'application/json', 'X-MoonSprite-Client': 'web' } : { Accept: 'application/json', 'X-MoonSprite-Client': 'web', 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body), signal,
    })
  } catch { throw new ApiError(signal.aborted ? 'timeout' : 'network') }
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const code = typeof payload?.error?.code === 'string' ? payload.error.code
      : ({ 401: 'unauthenticated', 403: 'forbidden', 404: 'missing', 409: 'conflict', 429: 'rate-limited' } as Record<number, string>)[response.status] ?? 'server'
    const wait = Number(response.headers.get('Retry-After') ?? payload?.error?.retryAfter ?? 0)
    throw new ApiError(code, response.status, Number.isFinite(wait) ? Math.max(0, Math.ceil(wait)) : 0)
  }
  if (response.status === 204) return undefined as T
  try { return await response.json() as T } catch { throw new ApiError('invalid-response', response.status) }
}
export async function attempt<T>(work: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try { return { ok: true, data: await work() } }
  catch (error) { return { ok: false, error: error instanceof ApiError ? error.code : 'network' } }
}
