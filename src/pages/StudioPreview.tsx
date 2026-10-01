import { useEffect, useState, lazy, Suspense } from 'react'
import { useAccount } from '../account/store'
import { useStudio } from '../studio/store'
import { studioToProduct } from '../market/catalogue'
import { readDraft, draftKey, listingPayload, type ListingDraft } from '../studio/listing-draft'
import { copy, type Language } from '../content'
import { Button, Alert, LoadingState } from '../ui'
const PackDetailPage = lazy(() => import('./Market').then(module => ({ default: module.PackDetailPage })))

export function StudioPreviewPage({ productId = 'new', language }: { productId?: string; language: Language }) {
  const { account, ready } = useAccount()
  const studio = useStudio()
  const [draft, setDraft] = useState<ListingDraft | null>(null)
  const [error, setError] = useState('')
  const [locale, setLocale] = useState(language)
  const back = productId === 'new' ? '#/studio/publish' : `#/studio/publish/${productId}`
  useEffect(() => {
    let active = true
    if (account) void readDraft(draftKey(account.id, productId)).then(value => {
      if (!active) return
      if (value) { setDraft(value); setLocale(value.locale) } else setError(language === 'zh' ? '找不到此浏览器中的草稿，请返回编辑页。' : 'Draft not found in this browser. Return to the editor.')
    }).catch(() => { if (active) setError(language === 'zh' ? '读取草稿失败，请返回重试。' : 'Could not load the draft. Return and retry.') })
    return () => { active = false }
  }, [account?.id, productId, language])
  return <main id="main" className="studio-preview-page">
    <div className="studio-preview-bar"><Button href={back}>{language === 'zh' ? '返回编辑' : 'Back to editor'}</Button><strong>{language === 'zh' ? '商品详情预览 · 尚未提交' : 'Product preview · Not submitted'}</strong>{draft?.englishEnabled && <Button onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}>{locale === 'zh' ? 'English' : '中文'}</Button>}</div>
    {ready && !account ? <Alert tone="info">{language === 'zh' ? '请先登录原账号，再预览其草稿。' : 'Sign in to the account that owns this draft.'}</Alert> : error ? <Alert tone="danger">{error}</Alert> : !draft ? <LoadingState label={language === 'zh' ? '正在载入预览…' : 'Loading preview…'} /> : <Suspense fallback={<LoadingState label="…" />}><PackDetailPage t={copy[locale]} language={locale} previewProduct={studioToProduct({ ...listingPayload(draft), id: draft.savedId ?? 'preview', publishedAt: 0 }, studio.products)} /></Suspense>}
  </main>
}
