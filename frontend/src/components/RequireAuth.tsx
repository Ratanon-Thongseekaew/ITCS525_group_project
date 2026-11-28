import { Navigate, Outlet, useLocation } from 'react-router'
import { getWorkspaceHomeUrl } from '@/config/workspace-navigation'
import { useSession } from '@/lib/auth-session'
import { isWorkspaceRole } from '@/types/workspace'

/**
 * Guards the signed-in routes. A temporary password only unlocks `/change-password`. Staff and
 * managers only open their own workspace (`/staff/*`, `/manager/*`); administrators open any.
 * This is navigation only: the API enforces access itself.
 */
export function RequireAuth() {
  const user = useSession()?.user
  const { pathname } = useLocation()
  const path = pathname.toLowerCase()
  const onChangePassword = /^\/change-password\/?$/.test(path)
  const pathRole = path.split('/')[1]
  const inAnotherWorkspace =
    isWorkspaceRole(pathRole) && user?.role !== 'admin' && pathRole !== user?.role

  if (!user) return <Navigate to="/login" replace />
  if (user.must_change_password) {
    return onChangePassword ? <Outlet /> : <Navigate to="/change-password" replace />
  }
  if (onChangePassword || inAnotherWorkspace) {
    return <Navigate to={getWorkspaceHomeUrl(user.role)} replace />
  }
  return <Outlet />
}
