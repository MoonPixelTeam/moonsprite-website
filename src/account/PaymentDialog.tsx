import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { request } from '../api/transport'
import { Alert, Button } from '../ui'
import type { Language } from '../content'

type Checkout = { orderId: string; name: string; money: string; paymentType: string; action: string; fields: Record<string, string> }
export function PaymentDialog({ orderId, language, onClose }: { orderId: string; language: Language; onClose: () => void }) {
  const zh = language === 'zh', titleId = useId(), dialog = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<Checkout | null>(null), [error, setError] = useState(false), [sending, setSending] = useState(false)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    const controller = new AbortController()
    setData(null); setError(false); setSending(false)
    void request<Checkout>(`/payments/${encodeURIComponent(orderId)}/checkout-data`, { signal: controller.signal })
      .then(setData).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => { controller.abort(); dialog.current?.close(); previous?.focus() }
  }, [orderId])
  return createPortal(<dialog className="payment-dialog" ref={dialog} aria-labelledby={titleId} onCancel={onClose}>
    <h2 id={titleId}>{zh ? '确认付款' : 'Confirm payment'}</h2>
    <p>{zh ? '请核对订单信息，确认后前往收银台付款。' : 'Review your order before continuing to checkout.'}</p>
    {error ? <Alert tone="danger">{zh ? '无法加载付款信息。请关闭弹窗后重试；如已付款，请刷新订单状态。' : 'Unable to load payment details. Close and retry, or refresh the order if already paid.'}</Alert> : !data ? <p role="status">{zh ? '正在读取订单…' : 'Loading order…'}</p> : <>
      <dl><dt>{zh ? '订单编号' : 'Order'}</dt><dd>{data.orderId}</dd><dt>{zh ? '商品' : 'Products'}</dt><dd>{data.name}</dd><dt>{zh ? '支付方式' : 'Payment method'}</dt><dd>{data.paymentType === 'wxpay' ? (zh ? '微信支付' : 'WeChat Pay') : (zh ? '支付宝' : 'Alipay')}</dd></dl>
      <div className="payment-dialog-total"><span>{zh ? '实际支付（人民币）' : 'Total (CNY)'}</span><strong>¥{data.money}</strong></div>
      <form method="post" action={data.action} onSubmit={() => setSending(true)}>
        {Object.entries(data.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        <Button block variant="primary" type="submit" disabled={sending}>{sending ? (zh ? '正在前往收银台…' : 'Redirecting…') : (zh ? '前往付款' : 'Proceed to payment')}</Button>
      </form>
    </>}
    <Button block onClick={onClose}>{zh ? '暂不付款' : 'Pay later'}</Button>
  </dialog>, document.body)
}
