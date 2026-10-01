import { useEffect, useState } from 'react'
import type { Copy, Language } from '../content'
import { useAccount } from '../account/store'
import { authHash, navigate, safeReturnTo } from '../router'
import { Alert, Button, Field, LoadingState } from '../ui'
import { request, ApiError } from '../api/transport'
import { ResetPassword } from '../account/ResetPassword'
import { emailCodeError } from '../account/email-code-error'
import { SITE_CONFIG } from '../config'

export function AuthPage({ t, language, mode, returnTo }: { t: Copy; language: Language; mode: 'login' | 'register'; returnTo?: string }) {
  const { account, ready, register, signIn } = useAccount()
  const s = t.accountPage
  const registering = mode === 'register'
  const destination = safeReturnTo(returnTo)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [codeNotice, setCodeNotice] = useState('')
  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown(value => value - 1), 1000); return () => clearTimeout(timer) }, [cooldown])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  useEffect(() => { if (ready && account) navigate(destination) }, [ready, account, destination])
  if (!ready || account) return <main id="main"><LoadingState label={s.working} /></main>
  const errors: Record<string, string> = { name: s.errorName, email: s.errorEmail, password: s.errorPassword, exists: s.errorExists, 'registration-code': language === 'zh' ? '验证码错误、已过期或尝试过多，请重新获取。' : 'Invalid or expired code. Request a new one.', 'mail-unavailable': language === 'zh' ? '邮件发送失败，请稍后重试。' : 'Email delivery failed. Try again later.', 'rate-limited': language === 'zh' ? '发送或操作过于频繁，请稍后重试。' : 'Too many requests. Try again later.' }
  return <main id="main" className="auth-page">
    <section className="auth-card" aria-labelledby="auth-title">
      <a className="auth-brand" href="#/"><img src="/assets/moonsprite-logo.svg" width="32" height="32" alt="" />MoonSprite</a>
      <header><h1 id="auth-title">{registering ? s.createAccount : s.signIn}</h1><p>{language === 'zh' ? '一个账户，管理你的购买与创作。' : 'One account for your purchases and creative work.'}</p></header>
      {resetting ? <ResetPassword language={language} initialEmail={email} /> : <form className="settings-form" onSubmit={async (event) => {
        event.preventDefault()
        if (busy) return
        setBusy(true); setError(null)
        try {
          const result = registering ? await register({ name, email, password, code }) : await signIn({ email, password })
          if (!result.ok) setError(errors[result.error] ?? s.errorCredentials)
        } catch { setError(language === 'zh' ? '暂时无法连接，请重试。' : 'Unable to connect. Please retry.') }
        finally { setBusy(false) }
      }}>
        {registering && <Field label={s.nameLabel}><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={40} required /></Field>}
        <Field label={s.emailLabel}><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setCode(''); setCodeNotice('') }} autoComplete="email" required /></Field>
        {registering && SITE_CONFIG.apiBaseUrl && <Field label={language === 'zh' ? '邮箱验证码' : 'Email verification code'} hint={language === 'zh' ? '验证后完成注册，邮箱自动绑定。验证码 10 分钟内有效。' : 'Verify your email to register. The code expires in 10 minutes.'}>
          <input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          <Button block disabled={busy || sending || cooldown > 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={async () => {
            setSending(true); setError(null); setCodeNotice('')
            try { const result = await request<{ retryAfter: number }>('/auth/register/code', { method: 'POST', body: { email } }); setCooldown(result.retryAfter); setCodeNotice(language === 'zh' ? '验证码已发送，请查看邮箱（包括垃圾邮件）。' : 'Code sent. Check your inbox and spam folder.') }
            catch (cause) { const key = cause instanceof ApiError ? cause.code : ''; setError(errors[key] ?? emailCodeError(cause, language)); if (cause instanceof ApiError && cause.retryAfter) setCooldown(cause.retryAfter) }
            finally { setSending(false) }
          }}>{sending ? (language === 'zh' ? '正在发送…' : 'Sending…') : cooldown > 0 ? `${cooldown}s` : language === 'zh' ? '获取验证码' : 'Get code'}</Button>
          {codeNotice && <p role="status">{codeNotice}</p>}
        </Field>}
        <Field label={s.passwordLabel}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} minLength={8} required /></Field>
        <p className="auth-note">{language === 'zh' ? '提交前请阅读' : 'Before submitting, read our '}<a href="#/privacy">{language === 'zh' ? '隐私政策' : 'Privacy Policy'}</a>{language === 'zh' ? '，了解信息用途、保存方式和删除规则。' : ' for information use, storage and deletion details.'}</p>
        {error && <Alert tone="danger" role="alert">{error}</Alert>}
        <Button type="submit" variant="primary" block disabled={busy}>{busy ? s.working : registering ? s.createAccount : s.signIn}</Button>
      </form>}
      {!registering && <Button onClick={() => setResetting(value => !value)}>{resetting ? (language === 'zh' ? '返回登录' : 'Back to sign in') : (language === 'zh' ? '忘记密码？' : 'Forgot password?')}</Button>}
      <p className="auth-switch">{language === 'zh' ? (registering ? '已有账户？' : '还没有账户？') : (registering ? 'Already have an account?' : 'New to MoonSprite?')} <a href={authHash(registering ? 'login' : 'register', destination)}>{registering ? s.signIn : s.createAccount}</a></p>
      {!SITE_CONFIG.apiBaseUrl && <p className="auth-note">{s.prototypeBody}</p>}
      <a className="auth-back" href="#/market">{t.marketPage.detail.back}</a>
    </section>
  </main>
}
