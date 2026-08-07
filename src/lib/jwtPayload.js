/**
 * Decode JWT payload (no signature verification — UI hints only; auth is enforced server-side).
 * @param {string | null | undefined} token
 * @returns {Record<string, unknown> | null}
 */
export function parseAccessTokenPayload(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const binary = atob(padded)
    const json = decodeURIComponent(
      Array.from(binary, (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
    )
    return JSON.parse(json)
  } catch {
    try {
      return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    } catch {
      return null
    }
  }
}

/** Effective role for UI from JWT/storage. */
export function resolveSessionRole(user, accessToken) {
  const payload = parseAccessTokenPayload(accessToken)
  const jwtRole = typeof payload?.role === 'string' ? payload.role.toLowerCase() : ''
  const userRole = String(user?.role ?? '').toLowerCase()
  if (jwtRole === 'admin') return 'super_admin'
  if (userRole === 'admin') return 'super_admin'
  if (jwtRole === 'super_admin' || userRole === 'super_admin') return 'super_admin'
  if (jwtRole === 'sales' || userRole === 'sales') return 'sales'
  if (jwtRole === 'delivery' || userRole === 'delivery') return 'delivery'
  if (jwtRole === 'custom' || userRole === 'custom') return 'custom'
  if (user?.role && typeof user.role === 'string') return user.role
  if (jwtRole) return jwtRole
  return 'user'
}
