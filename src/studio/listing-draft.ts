import type { PublishInput, StudioProduct } from '../api/types'
import { cnyToUsd, usdToCny } from '../market/catalog'

export type ListingDraft = {
  version: 1; updatedAt: number; step: number; locale: 'zh' | 'en'; englishEnabled: boolean
  savedId?: string; cny: string; sizes: string[]; input: PublishInput
  file: File | null; fileInfo: { name: string; size: number } | null
}
export function initialDraft(product?: StudioProduct | null): ListingDraft {
  return { version: 1, updatedAt: 0, step: 0, locale: 'zh', englishEnabled: Boolean(product && ([product.name, product.tagline, product.body, ...(product.includes ?? []), ...Object.values(product.animations?.labels ?? {})].some(value => value.en && value.en !== value.zh))),
    savedId: product?.id, cny: product ? String(product.priceCnyCents !== undefined ? product.priceCnyCents / 100 : usdToCny(product.price)) : '', sizes: product?.size ? [product.size] : [], file: null, fileInfo: null,
    input: product ? { ...product } : { name: { zh: '', en: '' }, tagline: { zh: '', en: '' }, body: { zh: '', en: '' }, price: 0, category: 'assets', size: '', formats: [], tags: [] } }
}
export function listingPayload(draft: ListingDraft): PublishInput {
  const localized = (value: { zh: string; en: string }) => ({ zh: value.zh.trim(), en: (draft.englishEnabled && value.en.trim()) || value.zh.trim() })
  const input = draft.input
  const animations = input.animations && { ...input.animations, labels: Object.fromEntries(Object.entries(input.animations.labels).map(([key, value]) => [key, localized(value)])) }
  return { ...input, name: localized(input.name), tagline: localized(input.tagline), body: localized(input.body),
    includes: input.includes?.filter(item => item.zh.trim() || (draft.englishEnabled && item.en.trim())).map(item => localized({ ...item, zh: item.zh.trim() || item.en.trim() })), priceCnyCents: Math.round(Number(draft.cny) * 100), price: cnyToUsd(Number(draft.cny)),  size: draft.sizes.join(' · '),
    packs: input.category === 'bundles' ? input.packs : undefined, animations: input.category === 'pets' ? animations : undefined }
}
export const draftKey = (accountId: string, productId = 'new') => `${accountId}:${productId}`
let connection: Promise<IDBDatabase> | undefined
function database() {
  return connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('moonsprite-listing-drafts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('drafts')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { connection = undefined; reject(request.error) }
  })
}
async function operation<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('drafts', mode)
    const request = action(transaction.objectStore('drafts'))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}
export async function readDraft(key: string) {
  const draft = await operation<ListingDraft | undefined>('readonly', store => store.get(key))
  if (draft && draft.version !== 1) throw new Error('Unsupported draft version')
  return draft
}
export const writeDraft = (key: string, draft: ListingDraft) => operation('readwrite', store => store.put(draft, key))
export const deleteDraft = (key: string) => operation('readwrite', store => store.delete(key))
