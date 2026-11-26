import type { User, UserRole } from '@/api'
import { getSession, signIn } from '@/lib/auth-session'

/**
 * Signs a test in before it renders a guarded route:
 * `signInAs('staff')`, then clear `sessionStorage` in `afterEach`.
 */
export function signInAs(role: UserRole, overrides: Partial<User> = {}) {
  const user: User = {
    id: 99,
    username: `${role}@example.com`,
    role,
    full_name: `Test ${role}`,
    must_change_password: false,
    store: role === 'staff' ? { id: 1, code: 'S1', name: 'Siam Square' } : null,
    ...overrides,
  }
  signIn({ token: 'test-token', user })
  return user
}

/** The signed-in test user, to answer `/api/auth/me` in a fetch mock. */
export function sessionUser() {
  return getSession()?.user
}
