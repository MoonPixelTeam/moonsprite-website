import type { Language } from '../content'

export function checkoutError(code: string, language: Language): string {
  const messages: Record<string, [string, string]> = {
    'payment-unavailable': ['收款尚未配置，免费素材仍可领取。', 'Payments are not configured. Free packs remain available.'],
    'pending-order': ['这些素材已有待付款订单，请到购买记录继续付款。', 'Continue the existing order from Purchases.'],
    'own-product': ['不能购买自己上架的付费素材，请在商家后台管理或下载。', 'Manage or download your own paid packs from the seller workspace.'],
    owned: ['你已拥有这些素材，请从购买记录下载，或移出购物车后继续。', 'You already own these packs. Download from Purchases or remove them from your cart.'],
    'missing-file': ['商品尚未上传可下载的资源文件，请联系商家补充。', 'The seller has not uploaded a downloadable file.'],
    unavailable: ['商品不存在、已下架或尚未审核通过，请刷新市场后重试。', 'This product is unavailable or awaiting approval. Refresh the market.'],
    unauthenticated: ['登录已失效，请重新登录后领取或付款。', 'Please sign in again before claiming or paying.'],
    'rate-limited': ['请求过于频繁，请稍后重试。', 'Too many requests. Try again later.'],
    network: ['网络连接失败，请检查网络后重试。', 'Check your connection and try again.'],
  }
  return (messages[code] ?? ['订单未完成，请稍后重试或联系支持。', 'Order failed. Try again or contact support.'])[language === 'zh' ? 0 : 1]
}
