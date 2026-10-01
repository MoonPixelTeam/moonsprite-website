import { useEffect, useState } from 'react'
import { request } from '../api/transport'
import { useAccount } from '../account/store'
import { Button, Select, Alert } from '../ui'
import type { Account } from '../api'
import type { Language } from '../content'

export function UserGroups({ language }: { language: Language }) {
  const { account } = useAccount()
  const [users, setUsers] = useState<Pick<Account, 'id' | 'name' | 'email' | 'roles'>[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [choices, setChoices] = useState<Record<string, string>>({})
  const zh = language === 'zh'
  useEffect(() => { void request<Account[]>('/admin/users').then(setUsers).catch(() => setError(zh ? '无法读取用户列表' : 'Could not load users')) }, [zh])
  const options = [{ value: 'buyer', label: zh ? '游客' : 'Visitor' }, { value: 'creator', label: zh ? '商家' : 'Merchant' }, { value: 'admin', label: zh ? '管理员' : 'Administrator' }]
  return <section>
    <p>{zh ? '商家继承游客权限，管理员继承商家权限。修改后该用户需重新登录；不能修改自己的权限组。' : 'Merchants inherit visitor permissions; administrators inherit merchant permissions. Changes revoke user sessions. You cannot change your own group.'}</p>
    {error && <Alert tone="danger">{error}</Alert>}
    <div className="workspace-table-scroll"><table className="studio-table"><thead><tr><th>{zh ? '用户' : 'User'}</th><th>{zh ? '权限组' : 'Group'}</th><th>{zh ? '操作' : 'Action'}</th></tr></thead><tbody>
      {users.map(user => { const role = user.roles?.includes('admin') ? 'admin' : user.roles?.includes('creator') ? 'creator' : 'buyer'; return <tr key={user.id}><td>{user.name}<br />{user.email}</td><td><Select label={zh ? '权限组' : 'Group'} value={choices[user.id] ?? role} options={options} onChange={value => setChoices(previous => ({ ...previous, [user.id]: value }))} /></td><td><Button disabled={busy || user.id === account?.id || !choices[user.id] || choices[user.id] === role} onClick={async () => {
        setBusy(true); setError('')
        try { const updated = await request<Account>('/admin/users/' + encodeURIComponent(user.id) + '/role', { method: 'PATCH', body: { role: choices[user.id] } }); setUsers(previous => previous.map(item => item.id === updated.id ? updated : item)) }
        catch { setError(zh ? '修改失败，请检查权限或重新登录。' : 'Update failed. Check permissions or sign in again.') }
        finally { setBusy(false) }
      }}>{zh ? '保存权限组' : 'Save group'}</Button></td></tr> })}
    </tbody></table></div>
  </section>
}
