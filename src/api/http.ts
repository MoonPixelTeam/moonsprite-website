import { request, attempt } from './transport'
import type { Account, ApiClient, ApiResult, AuthResult, Ledger, Order, OrderLine, PublishInput, StudioProduct, Withdrawal, WithdrawalStatus } from './types'

/*
 * The HTTP adapter for server/app.mjs. An explicitly empty VITE_API_BASE_URL
 * selects the separate browser-only prototype.
 *
 * The routes below are the contract a backend has to implement. They are deliberately
 * boring: JSON in, JSON out, a session cookie rather than a token in localStorage.
 */

export const httpAdapter: ApiClient = {
  auth: {
    async current(): Promise<Account | null> {
      return await request<Account | null>('/auth/session')
    },
    async signIn({ email, password }): Promise<AuthResult> {
      const result = await attempt(() => request<Account>('/auth/sign-in', { method: 'POST', body: { email, password } }))
      // The server decides which failures are worth naming; anything it rejects is
      // reported as bad credentials rather than leaking whether the address exists.
      return result.ok ? { ok: true, account: result.data } : { ok: false, error: result.error }
    },
    async register({ name, email, password, code }): Promise<AuthResult> {
      const result = await attempt(() => request<Account>('/auth/register', { method: 'POST', body: { name, email, password, code } }))
      return result.ok ? { ok: true, account: result.data } : { ok: false, error: result.error }
    },
    async signOut(): Promise<void> {
      await request<void>('/auth/sign-out', { method: 'POST' })
    },
    async updateName(name): Promise<AuthResult> {
      const result = await attempt(() => request<Account>('/auth/profile', { method: 'PATCH', body: { name } }))
      return result.ok ? { ok: true, account: result.data } : { ok: false, error: result.error }
    },
    async updateEmail(email): Promise<AuthResult> {
      const result = await attempt(() => request<Account>('/auth/profile', { method: 'PATCH', body: { email } }))
      return result.ok ? { ok: true, account: result.data } : { ok: false, error: result.error }
    },
    async changePassword({ current, next }) {
      return await attempt(() => request<void>('/auth/password', { method: 'POST', body: { current, next } }))
    },
    async requestPasswordReset(email) {
      await request('/auth/password/reset/code', { method: 'POST', body: { email } })
      return { ok: true, exists: false }
    },
    async verifyEmail(): Promise<AuthResult> {
      const result = await attempt(() => request<Account>('/auth/email/verify', { method: 'POST' }))
      return result.ok ? { ok: true, account: result.data } : { ok: false, error: result.error }
    },
    async deleteAccount(): Promise<void> {
      await request<void>('/auth/account', { method: 'DELETE' })
    },
  },
  orders: {
    async list(): Promise<Order[]> {
      return await request<Order[]>('/orders')
    },
    async create(lines: OrderLine[], paymentType?: 'alipay' | 'wxpay') {
      return await attempt(() => request<Order>('/orders', { method: 'POST', body: { lines: lines.map(({ id, quantity }) => ({ id, quantity })), ...(paymentType ? { paymentType } : {}) } }))
    },
    async all(): Promise<Order[]> {
      return await request<Order[]>('/studio/orders')
    },
  },
  catalogue: {
    /** Public and unauthenticated: this is what every visitor's market shows. */
    async all(): Promise<StudioProduct[]> {
      return await request<StudioProduct[]>('/catalogue')
    },
  },
  studio: {
    async products(): Promise<StudioProduct[]> {
      return await request<StudioProduct[]>('/studio/products')
    },
    async publish(input: PublishInput) {
      return await attempt(() => request<StudioProduct>('/studio/products', { method: 'POST', body: input }))
    },
    async update(id: string, input: PublishInput) {
      return await attempt(() => request<StudioProduct>(`/studio/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }))
    },
    async unpublish(id: string): Promise<void> {
      await request<void>(`/studio/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
    async ledger(): Promise<Ledger> {
      return await request<Ledger>('/studio/ledger')
    },
    async platformFee(): Promise<number> {
      const result = await request<{ percent: number }>('/studio/settings')
      return result.percent
    },
    async setPlatformFee(percent: number): Promise<void> {
      await request<void>('/studio/settings', { method: 'PATCH', body: { platformFeePercent: percent } })
    },
    async requestWithdrawal(amount: number, destination: string): Promise<ApiResult<Withdrawal>> {
      return await attempt(() => request<Withdrawal>('/studio/withdrawals', { method: 'POST', body: { amount, destination } }))
    },
    async setWithdrawalStatus(id: string, status: WithdrawalStatus, note?: string): Promise<void> {
      await request<void>(`/admin/withdrawals/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status, note } })
    },
    async allWithdrawals(): Promise<Withdrawal[]> {
      return await request<Withdrawal[]>('/admin/withdrawals')
    },
  },
}
