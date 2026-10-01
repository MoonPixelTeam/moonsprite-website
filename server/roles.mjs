export const roleGroups = {
  buyer: ['buyer'],
  creator: ['buyer', 'creator'],
  admin: ['buyer', 'creator', 'admin'],
}
export const hasRole = (account, role) => (account?.roles ?? []).some(group => roleGroups[group]?.includes(role))
