import { API_MODE } from './types'
import { request, attempt } from './transport'
import * as local from './localData'
import { currentLocalAccountId, isLocalAdmin } from './permissions'

export type CommunitySnapshot = {
  tickets: local.Ticket[]
  reports: local.Report[]
  statuses: local.ModerationDatabase['statuses']
}
export const communityApi = {
  async snapshot(): Promise<CommunitySnapshot> {
    if (API_MODE === 'http') return request('/community')
    const moderation = local.readModeration()
    return { tickets: local.readTickets(), statuses: moderation.statuses,
      reports: moderation.reports.filter(item => isLocalAdmin() || item.reporterId === currentLocalAccountId()) }
  },
  async openTicket(input: Parameters<typeof local.openTicket>[0]) {
    return API_MODE === 'local' ? local.openTicket(input) : attempt(() => request<void>('/support/tickets', { method: 'POST', body: input }))
  },
  async answerTicket(ticket: local.Ticket, reply: string) {
    if (API_MODE === 'local') return local.answerTicket(ticket, reply)
    await request('/admin/tickets/' + encodeURIComponent(ticket.id), { method: 'PATCH', body: { reply } })
  },
  async fileReport(input: Parameters<typeof local.fileReport>[0]) {
    return API_MODE === 'local' ? local.fileReport(input) : attempt(() => request<void>('/reports', { method: 'POST', body: input }))
  },
  async resolveReport(id: string) {
    if (API_MODE === 'local') return local.resolveReport(id)
    await request('/admin/reports/' + encodeURIComponent(id), { method: 'PATCH', body: { status: 'resolved' } })
  },
  async setStatus(id: string, status: local.ListingStatus, reason?: string) {
    if (API_MODE === 'local') return local.setListingStatus(id, status, reason)
    await request('/admin/listings/' + encodeURIComponent(id), { method: 'PATCH', body: { status, reason } })
  },
}
