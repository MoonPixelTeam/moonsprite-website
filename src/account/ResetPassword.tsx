import { useEffect, useState } from 'react'
import { request } from '../api/transport'
import { emailCodeError } from './email-code-error'
import { Alert, Button, Field, Input } from '../ui'
import type { Language } from '../content'

export function ResetPassword({ language, initialEmail = '' }: { language: Language; initialEmail?: string }) {
  const zh = language === 'zh'
  const [email, setEmail] = useState(initialEmail), [code, setCode] = useState(''), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false), [cooldown, setCooldown] = useState(0), [error, setError] = useState(''), [notice, setNotice] = useState('')
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(value => value - 1), 1000); return () => clearTimeout(timer) }, [cooldown])
  return <form className="settings-form" onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('')
    try { await request('/auth/password/reset', { method: 'POST', body: { email, code, password } }); setCode(''); setPassword(''); setNotice(zh ? '密码已重置，请使用新密码重新登录。' : 'Password reset. Sign in with your new password.'); window.dispatchEvent(new Event('storage')) }
    catch (cause) { setError(emailCodeError(cause, language)) } finally { setBusy(false) }
  }}>
    <Field label={zh ? '注册邮箱' : 'Registered email'}><Input type="email" autoComplete="email" value={email} required disabled={busy} onChange={event => { setEmail(event.target.value); setCode(''); setNotice('') }} /></Field>
    <Field label={zh ? '邮箱验证码' : 'Email verification code'} hint={zh ? '验证码 10 分钟内有效。' : 'Valid for 10 minutes.'}>
      <Input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
      <Button block disabled={busy || cooldown > 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={async () => {
        setBusy(true); setError(''); setNotice('')
        try { const result = await request<{ retryAfter: number }>('/auth/password/reset/code', { method: 'POST', body: { email } }); setCooldown(result.retryAfter); setNotice(zh ? '如果该邮箱已注册且邮件投递成功，你将收到验证码，请检查收件箱和垃圾邮件。' : 'If registered and delivery succeeds, this address will receive a code. Check inbox and spam.') }
        catch (cause) { setError(emailCodeError(cause, language)) } finally { setBusy(false) }
      }}>{cooldown ? `${cooldown}s` : zh ? '获取验证码' : 'Get code'}</Button>
    </Field>
    <Field label={zh ? '新密码' : 'New password'}><Input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></Field>
    {error && <Alert tone="danger" role="alert">{error}</Alert>}{notice && <Alert tone="info" role="status">{notice}</Alert>}
    <Button block variant="primary" type="submit" disabled={busy}>{zh ? '重置密码' : 'Reset password'}</Button>
  </form>
}
