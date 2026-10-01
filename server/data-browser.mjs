import { requireValue } from './validation.mjs'

// All SQL identifiers and expressions are defined here; clients never supply SQL.
const column = (key, zh, en, expression, type = 'text') => ({ key, zh, en, expression, type })
const j = field => `json_extract(data, '$.${field}')`
const id = column('id', '编号', 'ID', 'id')
const status = column('status', '状态', 'Status', j('status'), 'status')
const created = column('createdAt', '创建时间', 'Created', j('createdAt'), 'date')
const records = kind => `records WHERE kind='${kind}'`
export const datasets = {
  users: { zh: '用户', en: 'Users', from: 'accounts', columns: [id, column('name', '昵称', 'Name', j('name')), column('email', '邮箱', 'Email', 'email'), column('status', '权限组', 'Group', `CASE WHEN EXISTS (SELECT 1 FROM json_each(data, '$.roles') WHERE value='admin') THEN 'admin' WHEN EXISTS (SELECT 1 FROM json_each(data, '$.roles') WHERE value='creator') THEN 'creator' ELSE 'buyer' END`, 'status'), column('verified', '邮箱已验证', 'Email verified', j('emailVerified'), 'boolean'), created], statuses: ['buyer', 'creator', 'admin'] },
  products: { zh: '商品', en: 'Products', from: records('product'), columns: [id, column('name', '商品名称', 'Name', j('name.zh')), column('sellerId', '商家编号', 'Seller ID', 'owner'), column('category', '类型', 'Category', j('category'), 'status'), column('price', '售价（人民币）', 'Price (CNY)', `round(${j('price')} * 7.2, 2)`, 'money'), column('status', '审核状态', 'Review status', `CASE WHEN ${j('archived')} = 1 THEN 'archived' ELSE coalesce((SELECT json_extract(review.data, '$.status') FROM records AS review WHERE review.kind='review' AND review.id=records.id), 'pending') END`, 'status'), column('size', '资源规格', 'Specifications', j('size')), column('formats', '文件格式', 'Formats', `(SELECT group_concat(value, ' / ') FROM json_each(data, '$.formats'))`), column('updatedAt', '更新时间', 'Updated', `coalesce(${j('updatedAt')}, ${j('publishedAt')})`, 'date')], statuses: ['pending', 'approved', 'rejected', 'archived'] },
  orders: { zh: '订单', en: 'Orders', from: records('order'), columns: [id, column('accountId', '买家编号', 'Buyer ID', 'owner'), status, column('amount', '应付金额（人民币）', 'Amount due (CNY)', `${j('cnyCents')} / 100.0`, 'money'), column('items', '商品明细', 'Items', `(SELECT group_concat(json_extract(value, '$.name') || ' × ' || json_extract(value, '$.quantity'), '；') FROM json_each(data, '$.lines'))`), column('paymentType', '付款方式', 'Payment method', j('paymentType'), 'status'), created], statuses: ['pending', 'paid'] },
  tickets: { zh: '工单', en: 'Tickets', from: records('ticket'), columns: [id, column('accountId', '用户编号', 'User ID', 'owner'), column('subject', '主题', 'Subject', j('subject')), status, column('orderId', '关联订单', 'Order ID', j('orderId')), column('message', '问题描述', 'Message', j('message')), column('reply', '客服回复', 'Reply', j('reply')), created], statuses: ['open', 'answered'] },
  withdrawals: { zh: '提现', en: 'Withdrawals', from: records('withdrawal'), columns: [id, column('sellerId', '商家编号', 'Seller ID', 'owner'), column('amount', '提现金额（美元）', 'Amount (USD)', j('amount'), 'usd'), status, column('note', '处理备注', 'Note', j('note')), column('requestedAt', '申请时间', 'Requested', j('requestedAt'), 'date')], statuses: ['requested', 'approved', 'rejected', 'paid'] },
  files: { zh: '资源文件', en: 'Files', from: `(SELECT product_id AS id, metadata AS data, 'current' AS status FROM files UNION ALL SELECT product_id AS id, metadata AS data, 'draft' AS status FROM draft_files)`, columns: [id, column('name', '文件名', 'Filename', j('name')), column('size', '文件大小', 'Size', j('size'), 'bytes'), column('status', '文件版本', 'Version', 'status', 'status'), column('updatedAt', '上传时间', 'Uploaded', j('updatedAt'), 'date')], statuses: ['current', 'draft'] },
  events: { zh: '操作记录', en: 'Audit log', from: 'events', columns: [id, column('at', '操作时间', 'Time', 'at', 'date'), column('actor', '操作人编号', 'Actor ID', 'actor'), column('action', '操作', 'Action', 'action'), column('target', '目标编号', 'Target ID', 'target')], statuses: [] },
}
export function browseData(db, params) {
  const kind = params.get('dataset') ?? 'users'
  requireValue(Object.hasOwn(datasets, kind), 'dataset')
  const spec = datasets[kind]
  const pageText = params.get('page') ?? '1'
  requireValue(/^[1-9]\d{0,6}$/.test(pageText), 'page')
  const search = (params.get('q') ?? '').trim()
  requireValue(search.length <= 200, 'search')
  const filter = params.get('status') ?? ''
  requireValue(!filter || spec.statuses.includes(filter), 'status')
  const projection = spec.columns.map(col => `${col.expression} AS "${col.key}"`).join(', ')
  const base = `WITH visible AS (SELECT ${projection} FROM ${spec.from})`
  // Search only visible fields, never passwords, session tokens or file contents.
  const where = `WHERE (? = '' OR instr(lower(${spec.columns.map(col => `coalesce(CAST("${col.key}" AS TEXT), '')`).join(" || ' ' || ")}), lower(?)) > 0)${filter ? ' AND status = ?' : ''}`
  const values = filter ? [search, search, filter] : [search, search]
  const total = db.prepare(`${base} SELECT count(*) AS total FROM visible ${where}`).get(...values).total
  const pageSize = 25
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Number(pageText), pages)
  const sort = spec.columns.find(col => col.type === 'date')?.key ?? 'id'
  const rows = db.prepare(`${base} SELECT * FROM visible ${where} ORDER BY "${sort}" DESC, id DESC LIMIT ? OFFSET ?`).all(...values, pageSize, (page - 1) * pageSize)
  return { dataset: kind, columns: spec.columns.map(({ expression, ...col }) => col), datasets: Object.entries(datasets).map(([key, value]) => ({ key, zh: value.zh, en: value.en })), statuses: spec.statuses, rows, total, page, pages, pageSize }
}
