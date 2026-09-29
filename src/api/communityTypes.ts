export type WithdrawalStatus = 'requested' | 'approved' | 'paid' | 'rejected'

/** A support ticket. Software questions go to Discussions; these are order problems. */
export type Ticket = {
  accountId?: string
  reply?: string
  answeredAt?: number
  id: string
  subject: string
  message: string
  orderId?: string
  status: 'open' | 'answered'
  createdAt: number
}

export type ReportReason = 'copyright' | 'broken' | 'misleading' | 'other'

export type Report = {
  id: string
  productId: string
  productName: string
  reason: ReportReason
  detail: string
  reporterId?: string
  status: 'open' | 'resolved'
  createdAt: number
}

/**
 * A listing's review state. A pack is only on sale once approved, so the market cannot be
 * filled by a publish button alone.
 */
export type ListingStatus = 'pending' | 'approved' | 'rejected'

export type SupportStore = {
  tickets: Ticket[]
  answerTicket: (ticket: Ticket, reply: string) => Promise<void>
  openTicket: (input: { subject: string; message: string; orderId?: string }) => Promise<{ ok: true } | { ok: false; error: string }>
}

export type ModerationStore = {
  reports: Report[]
  fileReport: (input: { productId: string; productName: string; reason: ReportReason; detail: string }) => Promise<{ ok: true } | { ok: false; error: string }>
  resolveReport: (id: string) => Promise<void>
  statusOf: (productId: string) => ListingStatus
  setStatus: (productId: string, status: ListingStatus, reason?: string) => Promise<void>
  rejectionReason: (productId: string) => string | undefined
}

