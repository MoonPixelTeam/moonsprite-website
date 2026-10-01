import { useEffect, useState } from 'react'
import { apiIsLocal } from '../api'
import { ApiError, request } from '../api/transport'
import type { Language } from '../content'
import { Alert, Button, EmptyState, Field, Input, LoadingState, Panel, Select } from '../ui'

type Cell = string | number | null
type Column = { key: string; zh: string; en: string; type: string }
type Result = { dataset: string; columns: Column[]; datasets: { key: string; zh: string; en: string }[]; statuses: string[]; rows: Record<string, Cell>[]; total: number; page: number; pages: number; pageSize: number }
const labels: Record<string, string> = { buyer: '游客', creator: '商家', admin: '管理员', pending: '待处理', paid: '已支付', approved: '已通过', rejected: '已拒绝', archived: '已下架', open: '待回复', answered: '已回复', requested: '待审核', current: '当前交付文件', draft: '待审核文件', pets: '宠物', assets: '素材', bundles: '合集', extensions: '扩展', scripts: '脚本', alipay: '支付宝', wxpay: '微信支付' }
function statusLabel(value: string, dataset: string, zh: boolean) {
  if (!zh) return value
  if (value === 'pending') return dataset === 'orders' ? '待付款' : '待审核'
  if (value === 'paid' && dataset === 'withdrawals') return '已打款'
  return labels[value] ?? value
}
function display(value: Cell, col: Column, dataset: string, language: Language): string {
  if (value === null || value === '') return '—'
  const zh = language === 'zh'
  if (col.type === 'date') return new Date(Number(value)).toLocaleString(zh ? 'zh-CN' : 'en-US', { hour12: false })
  if (col.type === 'money' || col.type === 'usd') return new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US', { style: 'currency', currency: col.type === 'usd' ? 'USD' : 'CNY' }).format(Number(value))
  if (col.type === 'bytes') return Number(value) < 1024 ? `${value} B` : Number(value) < 1048576 ? `${(Number(value) / 1024).toFixed(1)} KB` : `${(Number(value) / 1048576).toFixed(2)} MB`
  if (col.type === 'boolean') return value ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No')
  if (col.type === 'status') return statusLabel(String(value), dataset, zh)
  return String(value)
}

export function DataBrowser({ language }: { language: Language }) {
  const zh = language === 'zh'
  const [query, setQuery] = useState({ dataset: 'users', page: 1, q: '', status: '' })
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  useEffect(() => {
    if (apiIsLocal) { setBusy(false); return }
    const controller = new AbortController()
    setBusy(true); setError(''); setSelected(null)
    const params = new URLSearchParams({ ...query, page: String(query.page) })
    void request<Result>('/admin/data?' + params, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult(data) }).catch(cause => {
      if (controller.signal.aborted) return
      setResult(null)
      setError(cause instanceof ApiError && (cause.status === 401 || cause.status === 403) ? (zh ? '需要管理员权限，请重新登录管理员账号。' : 'Administrator access required. Sign in again.') : cause instanceof ApiError && cause.status === 404 ? (zh ? '服务器尚未提供数据浏览接口，请更新后端后重试。' : 'Update the backend to enable data browsing.') : (zh ? '读取失败，请检查网络后点击刷新重试。' : 'Could not load data. Check the connection and refresh.'))
    }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [query, revision, zh])
  if (apiIsLocal) return <Alert tone="info">{zh ? '数据浏览需要连接后端，浏览器演示模式不提供服务器数据。' : 'Connect to the backend to browse server data.'}</Alert>
  const current = result?.dataset === query.dataset ? result : null
  const selectedRow = !busy && selected !== null ? current?.rows[selected] : null
  return <Panel title={zh ? '数据浏览 · 只读' : 'Data browser · Read only'}>
    <p className="panel-copy">{zh ? '按分类查看服务器上的最新数据。可搜索当前表格中的文字、邮箱或编号；长内容可点“查看详情”。' : 'Browse current server records. Search visible text, email addresses or IDs, and open details for long content.'}</p>
    <form className="data-browser-tools" onSubmit={event => { event.preventDefault(); setQuery({ ...query, page: 1, q: search.trim() }) }}>
      <Field label={zh ? '数据分类' : 'Dataset'}><Select label={zh ? '数据分类' : 'Dataset'} value={query.dataset} options={(result?.datasets ?? [{ key: 'users', zh: '用户', en: 'Users' }]).map(item => ({ value: item.key, label: item[language] }))} onChange={dataset => { setSearch(''); setQuery({ dataset, page: 1, q: '', status: '' }) }} /></Field>
      <Field label={zh ? '搜索当前分类' : 'Search this dataset'}><Input maxLength={200} value={search} onChange={event => setSearch(event.target.value)} placeholder={zh ? '昵称、邮箱、商品名称或编号' : 'Name, email or record ID'} /></Field>
      {(current?.statuses.length ?? 0) > 0 && <Field label={zh ? '状态筛选' : 'Filter by status'}><Select label={zh ? '状态筛选' : 'Filter by status'} value={query.status} options={[{ value: '', label: zh ? '全部' : 'All' }, ...current!.statuses.map(value => ({ value, label: statusLabel(value, query.dataset, zh) }))]} onChange={status => setQuery({ ...query, status, page: 1 })} /></Field>}
      <Button type="submit" variant="primary" disabled={busy}>{zh ? '搜索' : 'Search'}</Button>
      <Button disabled={busy} onClick={() => { setSearch(''); setQuery({ ...query, page: 1, q: '', status: '' }) }}>{zh ? '清除筛选' : 'Clear filters'}</Button>
      <Button disabled={busy} onClick={() => setRevision(value => value + 1)}>{zh ? '刷新' : 'Refresh'}</Button>
    </form>
    {error && <Alert tone="danger" role="alert">{error}</Alert>}
    {busy ? <LoadingState label={zh ? '正在读取数据…' : 'Loading records…'} /> : current && <>
      <p role="status">{zh ? `共 ${current.total} 条 · 第 ${current.page} / ${current.pages} 页 · 每页 ${current.pageSize} 条` : `${current.total} records · Page ${current.page} / ${current.pages} · ${current.pageSize} per page`}</p>
      {current.rows.length ? <div className="data-browser-scroll" tabIndex={0} role="region" aria-label={zh ? '数据表格，可横向滚动' : 'Data table, scroll horizontally'}><table className="data-browser-table"><caption>{current.datasets.find(item => item.key === current.dataset)?.[language]}</caption><thead><tr>{current.columns.map(col => <th key={col.key} scope="col">{col[language]}</th>)}<th scope="col">{zh ? '详情' : 'Details'}</th></tr></thead><tbody>{current.rows.map((row, index) => <tr key={`${row.id}-${index}`}>{current.columns.map(col => <td key={col.key}><span title={display(row[col.key], col, current.dataset, language)}>{display(row[col.key], col, current.dataset, language)}</span></td>)}<td><Button onClick={() => setSelected(index)}>{zh ? '查看详情' : 'View details'}</Button></td></tr>)}</tbody></table></div> : <EmptyState title={zh ? '没有匹配的数据' : 'No matching records'} description={zh ? '可清除筛选，或切换到其它分类查看。' : 'Clear the filters or select another dataset.'} />}
      <div className="data-browser-pages"><Button disabled={current.page <= 1} onClick={() => setQuery({ ...query, page: current.page - 1 })}>{zh ? '上一页' : 'Previous'}</Button><Button disabled={current.page >= current.pages} onClick={() => setQuery({ ...query, page: current.page + 1 })}>{zh ? '下一页' : 'Next'}</Button></div>
      {selectedRow && <section className="data-browser-detail" aria-label={zh ? '记录详情' : 'Record details'}><h3>{zh ? '记录详情' : 'Record details'}</h3><Button onClick={() => setSelected(null)}>{zh ? '收起详情' : 'Close details'}</Button><dl>{current.columns.map(col => <div key={col.key}><dt>{col[language]}</dt><dd>{display(selectedRow[col.key], col, current.dataset, language)}</dd></div>)}</dl></section>}
    </>}
  </Panel>
}
