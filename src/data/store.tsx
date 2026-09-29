import { useAccount } from '../account/store'
import { apiIsLocal } from '../api'
import { communityApi } from '../api/community'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { listingStatusOf, listingRejectionReason, DATA_EVENT } from '../api/localData'
import type { Ticket, Report, SupportStore, ModerationStore } from '../api/communityTypes'
export { readTickets, readModeration, answerTicket, openTicket, fileReport, resolveReport, listingStatusOf, listingRejectionReason, setListingStatus, DATA_EVENT } from '../api/localData'
export type { Ticket, Report, ReportReason, ListingStatus, WithdrawalStatus } from '../api/localData'
//
// React providers
//

type DataStore = SupportStore & ModerationStore & {
  version: number
}

const DataContext = createContext<DataStore | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { account } = useAccount()
  const [version, setVersion] = useState(0)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const identity = useRef(account?.id)
  identity.current = account?.id

  const [reviews, setReviews] = useState<Record<string, { status: import('../api/communityTypes').ListingStatus; reason?: string }>>({})
  const refresh = useCallback(async () => {
    const requestedIdentity = identity.current
    try {
      const snapshot = await communityApi.snapshot()
      if (requestedIdentity !== identity.current) return
      setTickets(snapshot.tickets)
      setReports(snapshot.reports)
      setReviews(snapshot.statuses)
      setVersion(value => value + 1)
    } catch (error) { console.warn('Could not load support and moderation data', error) }
  }, [])

  useEffect(() => {
    setTickets([]); setReports([]); setReviews({})
    refresh()
    window.addEventListener(DATA_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(DATA_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh, account?.id])

  const value = useMemo<DataStore>(() => ({
    tickets,
    answerTicket: async (ticket, reply) => { await communityApi.answerTicket(ticket, reply); await refresh() },
    openTicket: async (input) => {
      const result = await communityApi.openTicket(input)
      refresh()
      return result
    },
    reports,
    fileReport: async (input) => {
      const result = await communityApi.fileReport(input)
      refresh()
      return result
    },
    resolveReport: async (reportId) => {
      await communityApi.resolveReport(reportId)
      refresh()
    },
    statusOf: (id) => apiIsLocal ? listingStatusOf(id) : reviews[id]?.status ?? 'pending',
    setStatus: async (productId, status, reason) => {
      await communityApi.setStatus(productId, status, reason)
      window.dispatchEvent(new Event(DATA_EVENT))
    },
    rejectionReason: (id) => apiIsLocal ? listingRejectionReason(id) : reviews[id]?.reason,
    version,
  }), [tickets, reports, reviews, refresh, version])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataStore {
  const store = useContext(DataContext)
  if (!store) throw new Error('useData must be used inside DataProvider')
  return store
}
