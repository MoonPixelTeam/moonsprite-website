import type { Language, MarketProduct } from './catalog'

export function ProductSales({ product, language }: { product: MarketProduct; language: Language }) {
  const zh = language === 'zh'
  const label = product.price === 0 ? (zh ? '已领取' : 'Claimed') : (zh ? '已售' : 'Sold')
  const count = product.soldCount == null ? '—' : product.soldCount.toLocaleString(zh ? 'zh-CN' : 'en-US')
  return <span className="pack-sales" title={product.soldCount == null ? (zh ? '暂无统计' : 'Statistics unavailable') : `${label} ${count}`}>{label} {count}</span>
}

export function ProductFacts({ product, language }: { product: MarketProduct; language: Language }) {
  const zh = language === 'zh'
  const date = product.updatedAt ? new Date(product.updatedAt) : null
  const updated = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString(zh ? 'zh-CN' : 'en-US') : zh ? '未提供' : 'Not provided'
  return <dl className="product-facts">
    <div><dt>{zh ? '加购数量' : 'Added to carts'}</dt><dd>{product.cartCount == null ? (zh ? '暂无统计' : 'Not available') : product.cartCount.toLocaleString(zh ? 'zh-CN' : 'en-US')}</dd></div>
    <div><dt>{product.price === 0 ? (zh ? '已领取' : 'Claimed') : (zh ? '已售' : 'Sold')}</dt><dd>{product.soldCount == null ? (zh ? '暂无统计' : 'Not available') : product.soldCount.toLocaleString(zh ? 'zh-CN' : 'en-US')}</dd></div>
    <div><dt>{zh ? '更新时间' : 'Updated'}</dt><dd>{updated}</dd></div>
    <div><dt>{zh ? '兼容版本' : 'Compatibility'}</dt><dd>{product.compatibleVersion || (zh ? '未提供' : 'Not provided')}</dd></div>
  </dl>
}
