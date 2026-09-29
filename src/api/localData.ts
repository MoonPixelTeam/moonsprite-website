import { getFile } from './files'
import { currentLocalAccountId, isLocalAdmin, requireLocalAdmin } from './permissions'
import type { Ticket, Report, ReportReason, ListingStatus } from './communityTypes'
export type { Ticket, Report, ReportReason, ListingStatus, SupportStore, ModerationStore, WithdrawalStatus } from './communityTypes'
//
// Storage keys and shapes
//

const supportKey = () => `moonsprite-support:${currentLocalAccountId() ?? 'guest'}`
const MODERATION_KEY = 'moonsprite-moderation'

type SupportDatabase = { tickets: Ticket[] }
export type ModerationDatabase = { statuses: Record<string, { status: ListingStatus; reason?: string; at: number }>; reports: Report[] }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch (error) {
    console.warn(`MoonSprite data: could not read ${key}.`, error)
    return fallback
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new Event('moonsprite:data'))
    return true
  } catch (error) {
    console.warn(`MoonSprite data: could not write ${key}.`, error)
    return false
  }
}

const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`

/** Fires whenever any of the added stores change, so the UI can refresh. */
export const DATA_EVENT = 'moonsprite:data'

//
// Support tickets
//

export function readTickets(): Ticket[] {
  if (!currentLocalAccountId()) return []
  if (isLocalAdmin()) {
    const database = read<{ accounts: { id: string }[] }>('moonsprite-accounts', { accounts: [] })
    return database.accounts.flatMap((account) => read<SupportDatabase>(`moonsprite-support:${account.id}`, { tickets: [] }).tickets)
  }
  return read<SupportDatabase>(supportKey(), { tickets: [] }).tickets
}

export async function answerTicket(ticket: Ticket, reply: string): Promise<void> {
  requireLocalAdmin()
  if (!ticket.accountId || !reply.trim()) throw new Error('reply')
  const key = `moonsprite-support:${ticket.accountId}`
  const database = read<SupportDatabase>(key, { tickets: [] })
  if (!database.tickets.some((item) => item.id === ticket.id)) throw new Error('missing')
  if (!write(key, { tickets: database.tickets.map((item) => item.id === ticket.id ? { ...item, reply: reply.trim(), answeredAt: Date.now(), status: 'answered' } : item) })) throw new Error('storage')
}

export async function openTicket(input: { subject: string; message: string; orderId?: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!currentLocalAccountId()) return { ok: false, error: 'unauthenticated' }
  const userData = read<{ orders: Record<string, { id: string }[]> }>('moonsprite-accounts', { orders: {} })
  if (input.orderId && !(userData.orders[currentLocalAccountId() ?? ''] ?? []).some((order) => order.id === input.orderId)) return { ok: false, error: 'order' }
  if (input.subject.trim().length < 3) return { ok: false, error: 'subject' }
  if (input.message.trim().length < 10) return { ok: false, error: 'message' }
  const database = read<SupportDatabase>(supportKey(), { tickets: [] })
  const ticket: Ticket = {
    id: id('tkt'),
    accountId: currentLocalAccountId() ?? undefined,
    subject: input.subject.trim(),
    message: input.message.trim(),
    orderId: input.orderId,
    status: 'open',
    createdAt: Date.now(),
  }
  if (!write(supportKey(), { tickets: [ticket, ...database.tickets] })) return { ok: false, error: 'storage' }
  return { ok: true }
}

//
// Listing review and reports
//

export function readModeration(): ModerationDatabase {
  const raw = read<Partial<ModerationDatabase>>(MODERATION_KEY, { statuses: {}, reports: [] })
  return {
    statuses: raw.statuses && typeof raw.statuses === 'object' ? raw.statuses : {},
    reports: Array.isArray(raw.reports) ? raw.reports : [],
  }
}

/**
 * A listing with no record is pending, not approved: publishing puts a pack in the review
 * queue rather than on sale.
 */
export function listingStatusOf(productId: string): ListingStatus {
  const review = readModeration().statuses[productId]
  const product = read<{ products: { id: string; updatedAt?: number; publishedAt: number }[] }>('moonsprite-studio', { products: [] }).products.find((item) => item.id === productId)
  return review && (!product || review.at >= (product.updatedAt ?? product.publishedAt)) ? review.status : 'pending'
}

export function listingRejectionReason(productId: string): string | undefined {
  return readModeration().statuses[productId]?.reason
}

export async function setListingStatus(productId: string, status: ListingStatus, reason?: string): Promise<void> {
  requireLocalAdmin()
  if (status === 'approved' && !await getFile(productId)) throw new Error('missing-file')
  const database = readModeration()
  if (!write(MODERATION_KEY, {
    ...database,
    statuses: { ...database.statuses, [productId]: { status, reason, at: Date.now() } },
  })) throw new Error('storage')
}

export async function fileReport(input: { productId: string; productName: string; reason: ReportReason; detail: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!currentLocalAccountId()) return { ok: false, error: 'unauthenticated' }
  if (!input.reason) return { ok: false, error: 'reason' }
  const database = readModeration()
  const report: Report = {
    id: id('rpt'),
    reporterId: currentLocalAccountId() ?? undefined,
    productId: input.productId,
    productName: input.productName,
    reason: input.reason,
    detail: input.detail.trim(),
    status: 'open',
    createdAt: Date.now(),
  }
  if (!write(MODERATION_KEY, { ...database, reports: [report, ...database.reports] })) return { ok: false, error: 'storage' }
  return { ok: true }
}

export async function resolveReport(reportId: string): Promise<void> {
  requireLocalAdmin()
  const database = readModeration()
  if (!write(MODERATION_KEY, {
    ...database,
    reports: database.reports.map((item) => item.id === reportId ? { ...item, status: 'resolved' } : item),
  })) throw new Error('storage')
}

