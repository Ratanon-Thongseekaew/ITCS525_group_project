import { Navigate, Outlet, useLocation } from 'react-router'
import { getWorkspaceHomeUrl } from '@/config/workspace-navigation'
import { useSession } from '@/lib/auth-session'

/**
 * Guards the signed-in routes. A temporary password only unlocks `/change-password`, and only
 * administrators open `/admin/*`. This is navigation only: the API enforces access itself.
 */
export function RequireAuth() {
  const user = useSession()?.user
  const { pathname } = useLocation()
  const path = pathname.toLowerCase()
  const onChangePassword = /^\/change-password\/?$/.test(path)

  if (!user) return <Navigate to="/login" replace />
  if (user.must_change_password) {
    return onChangePassword ? <Outlet /> : <Navigate to="/change-password" replace />
  }
  if (onChangePassword || (user.role !== 'admin' && /^\/admin(\/|$)/.test(path))) {
    return <Navigate to={getWorkspaceHomeUrl(user.role)} replace />
  }
  return <Outlet />
}
