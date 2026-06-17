import { DELIVERY_HOME_PATH } from './deliveryRoutes.js'

/**
 * @param {string | null | undefined} role
 * @returns {string | null} Post-login path for staff roles, or null for storefront users.
 */
export function postLoginPathForRole(role) {
  const normalized = String(role ?? '').toLowerCase()
  if (normalized === 'delivery') return DELIVERY_HOME_PATH
  if (['super_admin', 'sales', 'admin'].includes(normalized)) return '/admin'
  return null
}
