import { useState } from 'react'
import type { MarketProduct } from './catalog'

export function useRelatedProducts(product: MarketProduct | undefined, siblings: MarketProduct[], disabled = false) {
  const [relatedSelection, setRelatedSelection] = useState<{ productId: string; ids: string[] } | null>(null)
  const relatedPool = product && !disabled ? siblings.filter((item) => item.id !== product.id) : []
  const selectedRelated = relatedSelection?.productId === product?.id
    ? relatedSelection?.ids.flatMap(id => relatedPool.filter(item => item.id === id)) ?? []
    : []
  const related = selectedRelated.length ? selectedRelated : relatedPool.slice(0, 4)
  const shuffleRelated = () => {
    if (!product) return
    const shuffle = (items: MarketProduct[]) => {
      const result = [...items]
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
      }
      return result
    }
    const visible = new Set(related.map(item => item.id))
    const next = [...shuffle(relatedPool.filter(item => !visible.has(item.id))), ...shuffle(related)].slice(0, 4)
    if (next.length > 1 && next.every((item, index) => item.id === related[index]?.id)) next.push(next.shift()!)
    setRelatedSelection({ productId: product.id, ids: next.map(item => item.id) })
  }
  return { related, shuffleRelated, canShuffle: relatedPool.length > 1 }
}
