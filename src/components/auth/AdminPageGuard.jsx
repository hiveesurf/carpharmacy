import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth.js'
import {
  customRoleCanAccessPath,
  firstAllowedAdminPath,
} from '../../lib/adminPagePermissions.js'

/**
 * Blocks custom-role employees from deep-linking to admin pages they lack.
 * Sales / delivery / super_admin pass through unchanged.
 */
export function AdminPageGuard({ children }) {
  const { sessionRole, adminPageKeys, authHydrated } = useAuth()
  const location = useLocation()

  if (!authHydrated) {
    return children
  }

  if (sessionRole !== 'custom') {
    return children
  }

  if (customRoleCanAccessPath(location.pathname, adminPageKeys)) {
    return children
  }

  const fallback = firstAllowedAdminPath(adminPageKeys)
  if (fallback === location.pathname) {
    return children
  }
  return <Navigate to={fallback} replace />
}
