export const userRoles = ['Manager', 'Store Staff'] as const
export type UserRole = (typeof userRoles)[number]

export const stores = ['Central World', 'IconSiam', 'Siam Square'] as const
export type Store = (typeof stores)[number]

export type UserStatus = 'Active' | 'Invited'

export interface TeamUser {
  id: string
  name: string
  email: string
  role: UserRole
  store: Store
  status: UserStatus
  createdAt: string
}
