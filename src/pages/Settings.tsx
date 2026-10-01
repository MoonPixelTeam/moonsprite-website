import { useState } from 'react'
import type { Copy, Language } from '../content'
import { useAccount } from '../account/store'
import { ResetPassword } from '../account/ResetPassword'
import { apiIsLocal } from '../api'
import { Alert, Button, Disclosure, Field, Input, Panel, SettingsRow, WorkspacePage } from '../ui'

type Setting = 'name' | 'email' | 'password' | 'reset' | 'delete'
type Result = { ok: true } | { ok: false; error: string }

export function SettingsPage({ t, language }: { t: Copy; language: Language }) {
  const s = t.accountSettings
  const zh = language === 'zh'
  const { account, updateName, changePassword, deleteAccount } = useAccount()
  const [name, setName] = useState(account?.name ?? '')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState<Setting | null>(null)
  const [feedback, setFeedback] = useState<{ setting: Setting; tone: 'success' | 'danger'; message: string } | null>(null)
  const failure = zh ? '操作失败，请重试。' : 'Could not save. Please retry.'

  const run = async (setting: Setting, action: () => Promise<Result>, success: string, errors: Record<string, string> = {}) => {
    if (pending) return false
    setPending(setting)
    setFeedback(null)
    try {
      const result = await action()
      setFeedback({ setting, tone: result.ok ? 'success' : 'danger', message: result.ok ? success : errors[result.error] ?? failure })
      return result.ok
    } catch {
      setFeedback({ setting, tone: 'danger', message: failure })
      return false
    } finally { setPending(null) }
  }
  const message = (setting: Setting) => feedback?.setting === setting && <Alert tone={feedback.tone} role={feedback.tone === 'danger' ? 'alert' : 'status'}>{feedback.message}</Alert>
  const saving = (setting: Setting, label: string) => pending === setting ? (zh ? '正在处理…' : 'Working…') : label

  if (!account) return <WorkspacePage title={s.title}><Panel><Button variant="primary" href="#/login">{t.accountPage.signIn}</Button></Panel></WorkspacePage>

  return <WorkspacePage title={s.title} subtitle={zh ? '管理个人资料与登录安全。每项修改单独保存。' : 'Manage your profile and sign-in security. Save each change separately.'}>
    <fieldset className="workspace-form-group account-settings-view" disabled={pending !== null} aria-busy={pending !== null}>
      <Panel title={zh ? '个人资料' : 'Profile'}>
        <SettingsRow title={zh ? '用户名' : 'Display name'} description={zh ? '用于显示你的账户名称，修改后不会影响登录。' : 'The name shown on your account. Changing it does not affect sign-in.'}>
          <form className="settings-form" onSubmit={(event) => {
            event.preventDefault()
            void run('name', () => updateName(name), zh ? '用户名已保存。' : 'Display name saved.', { name: zh ? '请输入有效的用户名。' : 'Enter a valid display name.' })
          }}>
            <Field label={zh ? '用户名' : 'Display name'}><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="nickname" maxLength={40} required /></Field>
            <Button type="submit" disabled={!name.trim() || name === account.name}>{saving('name', zh ? '保存用户名' : 'Save name')}</Button>
            {message('name')}
          </form>
        </SettingsRow>
        <SettingsRow title={zh ? '邮箱地址' : 'Email address'} description={zh ? '用于登录、接收账户通知与找回密码。' : 'Used for sign-in, account notifications and password recovery.'}>
          <Field label={zh ? '注册邮箱' : 'Registered email'} hint={zh ? '邮箱在注册时通过验证码绑定，暂不支持修改。' : 'Bound using a verification code during registration. Email changes are not currently supported.'}>
            <Input type="email" value={account.email} readOnly autoComplete="email" />
          </Field>
        </SettingsRow>
      </Panel>

      <Panel title={zh ? '登录安全' : 'Sign-in security'}>
        <SettingsRow title={zh ? '修改密码' : 'Change password'} description={zh ? '输入当前密码以确认身份。新密码至少 8 位，且不能与当前密码相同。' : 'Confirm your current password. Use at least 8 characters and choose a different password.'}>
          <form className="settings-form" onSubmit={(event) => {
            event.preventDefault()
            void run('password', () => changePassword({ current, next }), zh ? '登录密码已更新。' : 'Password updated.', { current: s.errorCurrent, same: s.errorSame }).then((ok) => { if (ok) { setCurrent(''); setNext('') } })
          }}>
            <Field label={s.currentPassword}><Input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required /></Field>
            <Field label={s.newPassword}><Input type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" minLength={8} required /></Field>
            <Button type="submit" disabled={!current || next.length < 8}>{saving('password', s.changePassword)}</Button>
            {message('password')}
          </form>
          <Disclosure title={s.forgotTitle}>
            <ResetPassword language={language} initialEmail={account.email} />
          </Disclosure>
        </SettingsRow>
      </Panel>

      <Panel title={zh ? '账户注销' : 'Delete account'} className="workspace-danger">
        <SettingsRow title={zh ? '永久删除账户' : 'Permanently delete account'} description={s.deleteWarning}>
          <form className="settings-form" onSubmit={(event) => {
            event.preventDefault()
            if (confirm !== 'DELETE') return
            void run('delete', async () => { await deleteAccount(); return { ok: true } }, s.deleted)
          }}>
            <Field label={s.deleteConfirm} hint={zh ? '此操作无法撤销，请输入 DELETE 确认。' : 'This cannot be undone. Enter DELETE to confirm.'}><Input value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="DELETE" autoComplete="off" spellCheck={false} required /></Field>
            <Button type="submit" disabled={confirm !== 'DELETE'}>{saving('delete', s.deleteAccount)}</Button>
            {message('delete')}
          </form>
        </SettingsRow>
      </Panel>
    </fieldset>
  </WorkspacePage>
}
