import { useEffect, useRef, useState } from 'react'
import type { Copy, Language } from '../content'
import { useStudio, type StudioProduct } from '../studio/store'
import { useAccount } from '../account/store'
import { Alert, Button, Panel, ChipField, Field, FileField, Select, Input, Textarea, Checkbox, LoadingState } from '../ui'
import { ListingFields } from '../studio/ListingFields'
import { getFile, putFile } from '../api/files'
import { saveListing } from '../studio/save-listing'
import { draftKey, initialDraft, listingPayload, readDraft, writeDraft, deleteDraft, type ListingDraft } from '../studio/listing-draft'
import { importPet } from '../studio/import-pet'
import { navigate } from '../router'

const formatPresets: Record<string, string[]> = { pets: ['.mspet'], assets: ['PNG', 'GIF', 'Sprite sheet', '.moonsprite', '.ase', 'PSD'], bundles: ['ZIP', '.mspet', 'PNG'], extensions: ['.msext'], scripts: ['Lua', 'JavaScript', 'ZIP'] }
const tagPresets: Record<string, string[]> = { pets: ['宠物', '像素', '动物', '角色'], assets: ['角色', '场景', '图标', 'UI', '地形'], bundles: ['合集', '角色', '场景'], extensions: ['工具', '效率', '动画'], scripts: ['自动化', '批处理', '绘图'] }

export function StudioPublish({ t, language, editing, onDone }: { t: Copy; language: Language; editing?: StudioProduct | null; onDone?: () => void }) {
  const zh = language === 'zh'
  const s = t.studioPage
  const studio = useStudio()
  const { account } = useAccount()
  const key = draftKey(account!.id, editing?.id)
  const [draft, setDraft] = useState(() => initialDraft(editing))
  const [ready, setReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState('')
  const [tried, setTried] = useState(false)
  const completed = useRef(false)
  const savePending = useRef(false)
  const latest = useRef(draft)
  latest.current = draft
  const patch = (value: Partial<ListingDraft>) => setDraft(current => ({ ...current, ...value, updatedAt: Date.now() }))
  const patchInput = (value: Partial<ListingDraft['input']>) => setDraft(current => ({ ...current, input: { ...current.input, ...value }, updatedAt: Date.now() }))
  const { input, step, locale } = draft
  const steps = zh ? ['上传资源', '基本信息', '商品介绍', '图片与动画', '确认提交'] : ['Upload', 'Basics', 'Description', 'Media', 'Review']

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const stored = await readDraft(key)
        if (!active) return
        if (stored) { setDraft(stored); setNotice(zh ? '已恢复上次的草稿和文件，可以继续填写。' : 'Your draft and file have been restored.'); return }
        if (editing) {
          const file = await getFile(editing.id)
          if (active) setDraft(current => ({ ...current, fileInfo: file ? { name: file.name, size: file.size } : null }))
        }
      } catch { if (active) { setLoadFailed(true); setError(zh ? '无法恢复草稿或原文件，请检查浏览器存储和网络后重新进入。' : 'Could not restore the draft or file. Check storage and connection, then reopen.') } }
      finally { if (active) setReady(true) }
    })()
    return () => { active = false }
  }, [key])
  useEffect(() => {
    if (!ready || loadFailed || completed.current) return
    let active = true
    savePending.current = true
    setSaveState(zh ? '正在保存…' : 'Saving…')
    void writeDraft(key, draft).then(() => { if (active) { savePending.current = false; setSaveState(zh ? '草稿已保存到此浏览器' : 'Draft saved in this browser') } }).catch(() => { if (active) { savePending.current = true; setSaveState(zh ? '保存失败，请勿关闭页面；检查浏览器剩余空间。' : 'Save failed. Keep this page open and check browser storage.') } })
    return () => { active = false }
  }, [draft, ready, loadFailed, key, zh])
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (savePending.current && !completed.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [])
  const missing = [
    !draft.fileInfo ? { step: 0, label: s.fieldFile } : null,
    input.name.zh.trim().length < 2 ? { step: 1, label: zh ? '中文名称（至少 2 个字）' : 'Chinese name (at least 2 characters)' } : null,
    !draft.cny.trim() || !Number.isFinite(Number(draft.cny)) || Number(draft.cny) < 0 || Number(draft.cny) > 720000 ? { step: 1, label: zh ? '有效价格（免费填写 0）' : 'Valid price (0 for free)' } : null,
    !input.formats.length ? { step: 1, label: s.fieldFormats } : null,
    input.category === 'bundles' && (!input.packs?.length || input.packs.some(id => !studio.products.some(product => product.id === id && product.category !== 'bundles'))) ? { step: 2, label: zh ? '有效的合集成员' : 'Available bundle members' } : null,
  ].filter((item): item is { step: number; label: string } => Boolean(item))
  const readPack = async (file?: File) => {
    if (!file) return
    if (!file.size || file.size > 50 * 1024 * 1024) { setError(zh ? '请选择不超过 50 MB 的非空资源文件。' : 'Choose a nonempty file under 50 MB.'); return }
    patch({ file, fileInfo: { name: file.name, size: file.size } }); setError(''); setNotice('')
    if (!/\.mspet$/i.test(file.name)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      patchInput({ category: ext === 'msext' ? 'extensions' : ext === 'lua' || ext === 'js' ? 'scripts' : input.category, name: { ...input.name, zh: input.name.zh || file.name.replace(/\.[^.]+$/, '').slice(0, 48) }, formats: input.formats.length ? input.formats : [ext === 'zip' ? 'ZIP' : '.' + ext] })
      return
    }
    setMediaBusy(true)
    try {
      const pet = await importPet(file)
      setDraft(current => ({ ...current, updatedAt: Date.now(), sizes: [pet.size], input: { ...current.input, category: 'pets', formats: ['.mspet'],
        name: { ...current.input.name, zh: current.input.name.zh || pet.name }, tagline: { ...current.input.tagline, zh: current.input.tagline.zh || pet.tagline },
        body: { ...current.input.body, zh: current.input.body.zh || pet.body }, image: current.input.image || pet.image, animations: pet.animations,
        includes: current.input.includes?.length ? current.input.includes : pet.includes } }))
      setNotice(zh ? '已识别宠物名称、尺寸、动画和交互，并生成介绍与内容清单。请核对信息并自行定价。' : 'Pet information, animations and interactions imported. Review the copy and choose a price.')
    } catch (cause) { setError(zh ? `文件已保留，但自动识别失败：${cause instanceof Error ? cause.message : '请重新导出宠物包'}。可重新选择文件或手动填写。` : 'File retained, but pet import failed. Re-export the pet or fill in the details manually.') }
    finally { setMediaBusy(false) }
  }
  const readCover = async (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 512 * 1024) { setError(zh ? '封面请使用不超过 512 KB 的 PNG / JPG / WebP / GIF。' : 'Use a PNG / JPG / WebP / GIF under 512 KB.'); return }
    setMediaBusy(true)
    try {
      const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      patchInput({ image: source })
    } catch { setError(s.errorCover) } finally { setMediaBusy(false) }
  }
  const preview = async () => {
    setBusy(true)
    try { await writeDraft(key, latest.current); navigate(`#/studio/preview/${editing?.id ?? 'new'}`) }
    catch { setError(zh ? '预览前保存失败，请检查浏览器存储空间。' : 'Could not save the preview. Check browser storage.') }
    finally { setBusy(false) }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || mediaBusy || completed.current) return
    if (step !== 4) { next(); return }
    setTried(true)
    if (missing.length) { patch({ step: missing[0].step }); return }
    setBusy(true); setError('')
    try {
      const result = await saveListing({ studio, payload: listingPayload(draft), savedId: draft.savedId, file: draft.file, putFile,
        rememberId: id => { const next = { ...latest.current, savedId: id }; latest.current = next; setDraft(next); void writeDraft(key, next).catch(() => {}) } })
      if (!result.ok) { setError(result.error === 'file' ? (zh ? '文件上传失败，草稿和商品编号已保留，再次提交会重试。' : 'Upload failed. Retry with the retained listing and draft.') : s.errorStorage); return }
      completed.current = true
      try { await deleteDraft(key) } catch { setError(zh ? '商品已提交，但本地草稿清理失败，请勿重复提交。' : 'Submitted, but local draft cleanup failed. Do not submit again.'); return }
      onDone?.()
    } catch { setError(s.errorStorage) } finally { setBusy(false) }
  }
  const next = () => {
    setTried(true)
    if (missing.some(item => item.step === step)) return
    patch({ step: Math.min(4, step + 1) }); setTried(false)
  }
  const textField = (key: 'name' | 'tagline' | 'body', label: string, max: number, placeholder: string) => <Field label={label} badge={key === 'name' && locale === 'zh' ? s.required : s.optional} counter={s.counter(input[key][locale].length, max)}>
    {key === 'body' ? <Textarea rows={7} maxLength={max} value={input[key][locale]} placeholder={placeholder} onChange={event => patchInput({ [key]: { ...input[key], [locale]: event.target.value } })} /> : <Input maxLength={max} value={input[key][locale]} placeholder={placeholder} onChange={event => patchInput({ [key]: { ...input[key], [locale]: event.target.value } })} />}
  </Field>
  if (loadFailed) return <Alert tone="danger">{error}</Alert>
  if (!ready) return <LoadingState label={zh ? '正在恢复草稿…' : 'Restoring draft…'} />
  return <form className="studio-wizard" onSubmit={submit} noValidate>
    <div className="studio-wizard-toolbar">
      <div className="studio-wizard-languages"><Button variant={locale === 'zh' ? 'primary' : 'secondary'} disabled={busy || mediaBusy} onClick={() => patch({ locale: 'zh' })}>中文</Button>
        {draft.englishEnabled && <Button variant={locale === 'en' ? 'primary' : 'secondary'} disabled={busy || mediaBusy} onClick={() => patch({ locale: 'en' })}>English</Button>}
        <Checkbox label={zh ? '添加英文版（可选）' : 'Add English version (optional)'} checked={draft.englishEnabled} onChange={value => { if (!busy && !mediaBusy) patch({ englishEnabled: value, locale: value ? locale : 'zh' }) }} />
      </div>
      <small role="status">{saveState}</small>
    </div>
    <p className="studio-hint">{locale === 'en' ? 'English copy is optional. Empty fields use Chinese. Files, price and specifications are shared.' : '一次只需完成一步。英文可选，留空时使用中文；文件、价格和规格共用。'}</p>
    <nav className="studio-wizard-steps" aria-label={zh ? '上架步骤' : 'Publishing steps'}>{steps.map((title, index) => <Button key={title} variant={step === index ? 'primary' : 'secondary'} disabled={busy || mediaBusy} ariaLabel={`${index + 1}. ${title}${step === index ? (zh ? '，当前步骤' : ', current step') : ''}`} onClick={() => { patch({ step: index }); setTried(false) }}>{index + 1}. {title}</Button>)}</nav>
    {notice && <Alert tone="info">{notice}</Alert>}
    {error && <Alert tone="danger" role="alert">{error}</Alert>}
    <fieldset className="studio-form-fields" disabled={busy || mediaBusy || completed.current}>
      <h2>{steps[step]}</h2>
      {step === 0 && <Panel title={zh ? '先放入买家将收到的文件' : 'Start with the downloadable file'}>
        <p className="studio-hint">{zh ? '宠物包会自动识别信息和动画。其它资源先选择文件，再完善介绍。文件仅在提交时上传。' : 'Pet packs import their information and animations. Files upload only when you submit.'}</p>
        <FileField label={s.fieldFile} file={draft.fileInfo} onPick={file => { void readPack(file) }} onClear={() => patch({ file: null, fileInfo: null })} emptyTitle={zh ? '选择或拖入资源包' : 'Choose or drop a resource pack'} emptyHint={zh ? '.mspet / .msext / ZIP 等，不超过 50 MB' : '.mspet / .msext / ZIP, up to 50 MB'} replaceLabel={s.fileReplace} clearLabel={s.fieldCoverRemove} />
        {mediaBusy && <p role="status">{zh ? '正在识别资源…' : 'Reading resource…'}</p>}
      </Panel>}
      {step === 1 && <Panel title={zh ? '让买家快速了解这份资源' : 'Introduce your resource'} className="studio-fieldset">
        {textField('name', s.fieldName, 48, locale === 'zh' ? '例如：月猫桌面宠物' : 'Example: Mooncat desktop pet')}
        <div className="studio-row"><Field label={zh ? '售价（人民币）' : 'Price (CNY)'} badge={s.required} hint={zh ? '免费填 0；价格由你决定，不会自动定价。' : 'Enter 0 for free. Set your own price.'}><Input type="number" min="0" step="0.01" value={draft.cny} onChange={event => patch({ cny: event.target.value })} placeholder={zh ? '输入价格，免费填 0' : 'Enter price, or 0 for free'} /></Field>
        <Field label={s.fieldCategory}><Select label={s.fieldCategory} value={input.category} onChange={category => patchInput({ category })} options={(['assets', 'pets', 'bundles', 'extensions', 'scripts'] as const).map(value => ({ value, label: t.marketPage.categories[value] }))} /></Field></div>
        <ChipField label={s.fieldSize} value={draft.sizes} presets={s.presetSizes[input.category] ?? []} onChange={sizes => patch({ sizes })} customPlaceholder={s.sizeCustomPlaceholder} addLabel={s.addValue} removeLabel={s.fieldCoverRemove} />
        <ChipField label={s.fieldFormats} badge={s.required} value={input.formats} presets={formatPresets[input.category] ?? []} onChange={formats => patchInput({ formats })} customPlaceholder={s.formatCustomPlaceholder} addLabel={s.addValue} removeLabel={s.fieldCoverRemove} />
      </Panel>}
      {step === 2 && <>
        <Panel title={zh ? '描述用途与交付内容' : 'Describe usage and contents'} className="studio-fieldset">
          {textField('tagline', s.fieldTagline, 60, locale === 'zh' ? '用一句话说明资源的特色或用途' : 'What makes this resource useful?')}
          {textField('body', s.fieldBody, 5000, locale === 'zh' ? '资源适合什么场景？\n如何安装或使用？\n有哪些使用限制或注意事项？' : 'What is it for?\nHow do buyers install or use it?\nAny usage limits or requirements?')}
          <ChipField label={s.fieldTags} value={input.tags} presets={tagPresets[input.category] ?? []} onChange={tags => patchInput({ tags })} customPlaceholder={zh ? '添加准确的关键词' : 'Add a relevant keyword'} addLabel={s.addValue} removeLabel={s.fieldCoverRemove} />
        </Panel>
        <ListingFields section="contents" locale={locale} value={input} onChange={patchInput} category={input.category} products={studio.products.filter(product => product.id !== editing?.id)} language={language} onBusy={setMediaBusy} />
      </>}
      {step === 3 && <>
        <Panel title={s.groupCover} className="studio-fieldset">
          {input.image && <img src={input.image} alt={s.groupCover} className="studio-cover-preview" />}
          <FileField label={s.groupCover} file={null} onPick={file => { void readCover(file) }} accept="image/png,image/jpeg,image/webp,image/gif" emptyTitle={input.image ? s.fieldCoverReplace : s.fieldCoverHint} emptyHint={zh ? '建议正方形图片，不超过 512 KB；宠物包会自动提取封面。' : 'Square image under 512 KB; pet covers are extracted automatically.'} replaceLabel={s.fieldCoverReplace} clearLabel={s.fieldCoverRemove} />
          {input.image && <Button onClick={() => patchInput({ image: undefined })}>{s.fieldCoverRemove}</Button>}
        </Panel>
        <ListingFields section="media" locale={locale} value={input} onChange={patchInput} category={input.category} products={studio.products} language={language} onBusy={setMediaBusy} />
      </>}
      {step === 4 && <Panel title={zh ? '检查后提交审核' : 'Review before submitting'}>
        <dl className="studio-review"><dt>{s.fieldName}</dt><dd>{input.name.zh || '—'}</dd><dt>{s.fieldPrice}</dt><dd>{draft.cny === '' ? '—' : Number(draft.cny) === 0 ? (zh ? '免费' : 'Free') : `¥${draft.cny}`}</dd><dt>{s.fieldFile}</dt><dd>{draft.fileInfo?.name ?? '—'}</dd><dt>{s.fieldFormats}</dt><dd>{input.formats.join(' / ') || '—'}</dd><dt>{zh ? '语言' : 'Languages'}</dt><dd>{draft.englishEnabled ? '中文 / English' : '中文'}</dd></dl>
        <p className="studio-hint">{zh ? '先打开独立商品详情页，确认买家看到的效果。提交后将进入审核。' : 'Open the standalone detail preview to check the buyer experience, then submit for review.'}</p>
        <Button onClick={() => { void preview() }}>{zh ? '打开商品详情预览' : 'Open detail preview'}</Button>
        {missing.length > 0 && <p>{zh ? '还需补充：' : 'Still needed: '}{missing.map(item => item.label).join('、')}</p>}
      </Panel>}
      {tried && missing.some(item => item.step === step) && <Alert tone="danger" role="alert">{zh ? '请补充：' : 'Complete: '}{missing.filter(item => item.step === step).map(item => item.label).join('、')}</Alert>}
      <div className="studio-wizard-footer"><Button disabled={step === 0} onClick={() => { patch({ step: step - 1 }); setTried(false) }}>{zh ? '上一步' : 'Back'}</Button><span>{step + 1} / {steps.length}</span>
        {step < 4 ? <Button key="next" variant="primary" onClick={next}>{zh ? '下一步' : 'Next'}</Button> : <Button key="submit" type="submit" variant="primary">{busy ? (zh ? '正在提交…' : 'Submitting…') : (zh ? '提交审核' : 'Submit for review')}</Button>}
      </div>
    </fieldset>
  </form>
}
