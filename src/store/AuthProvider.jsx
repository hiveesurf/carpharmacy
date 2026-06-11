import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from '../context/auth-context.js'
import * as authService from '../services/authService.js'
import { apiV1Base, refreshSessionWithCookie } from '../api/client.js'
import { subscribeAccessTokenChanged } from '../lib/authTokenEvents.js'
import { getAccessToken } from '../lib/authTokens.js'
import { parseAccessTokenPayload, resolveSessionRole } from '../lib/jwtPayload.js'
import { subscribeSessionDead, notifySessionDead } from '../lib/sessionEvents.js'
import { notifyWorkforceAvailabilityChanged } from '../lib/workforceEvents.js'

const STORAGE_USER = 'carnalysys-user-v2'

function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER)
    if (!raw) return null
    const u = JSON.parse(raw)
    if (u && typeof u.phone === 'string' && typeof u.name === 'string') {
      const next = { ...u, role: typeof u.role === 'string' ? u.role : 'user' }
      if (typeof u.avatarUrl === 'string' && u.avatarUrl) next.avatarUrl = u.avatarUrl
      if (typeof u.secondaryPhone === 'string') next.secondaryPhone = u.secondaryPhone
      return next
    }
  } catch {
    /* ignore */
  }
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)
  const [modalOpen, setModalOpen] = useState(false)
  /** Bumps when access token is set/cleared so role can be re-derived from JWT (e.g. after silent refresh). */
  const [tokenVersion, setTokenVersion] = useState(0)
  /** False until we finish optional refresh when API + stored user (avoids wishlist before JWT exists). */
  const [authHydrated, setAuthHydrated] = useState(() => !(apiV1Base() && loadUser()))
  useEffect(() => {
    return subscribeAccessTokenChanged(() => setTokenVersion((v) => v + 1))
  }, [])

  useEffect(() => {
    return subscribeSessionDead(() => setUser(null))
  }, [])

  const sessionRole = useMemo(
    () => resolveSessionRole(user, getAccessToken()),
    [user, tokenVersion],
  )
  const isAdmin = ['super_admin', 'sales', 'delivery', 'admin'].includes(sessionRole)

  /**
   * Align cached `user.role` with the access token when possible so employee roles (e.g. delivery)
   * are not overwritten by the legacy fallback that upgraded unknown roles to super_admin.
   */
  useEffect(() => {
    if (!isAdmin) return
    const payload = parseAccessTokenPayload(getAccessToken())
    const jwtRoleRaw = typeof payload?.role === 'string' ? payload.role.trim().toLowerCase() : ''
    const jwtMapped =
      jwtRoleRaw === 'admin' || jwtRoleRaw === 'super_admin'
        ? 'super_admin'
        : jwtRoleRaw === 'sales' || jwtRoleRaw === 'delivery'
          ? jwtRoleRaw
          : ''
    setUser((u) => {
      if (!u) return u
      if (jwtMapped && String(u.role).toLowerCase() !== jwtMapped) {
        return { ...u, role: jwtMapped }
      }
      if (
        !jwtMapped &&
        !['super_admin', 'sales', 'delivery'].includes(String(u.role).toLowerCase())
      ) {
        return { ...u, role: 'super_admin' }
      }
      return u
    })
  }, [isAdmin, tokenVersion])

  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_USER, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_USER)
  }, [user])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!apiV1Base() || !loadUser()) {
        if (!cancelled) setAuthHydrated(true)
        return
      }
      const data = await authService.tryRefreshSession()
      if (cancelled) return
      if (data?.user) setUser(data.user)
      else setUser(null)
      setAuthHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Re-load role (and name) from DB whenever we have a token, and rotate refresh/JWT if DB role
   * disagrees with the access token — otherwise admin UI can show while /admin/* still 403s.
   */
  useEffect(() => {
    if (!apiV1Base() || !authHydrated || !getAccessToken()) return
    let cancelled = false
    ;(async () => {
      const profile = await authService.fetchSessionUser()
      if (cancelled || !profile || typeof profile.phone !== 'string') return

      const dbRoleRaw = typeof profile.role === 'string' ? profile.role : 'user'
      const dbRole = dbRoleRaw.toLowerCase()

      setUser((prev) => {
        const name =
          typeof profile.name === 'string' && profile.name.trim()
            ? profile.name
            : (prev?.name ?? `User ${String(profile.phone).slice(-4)}`)
        return {
          id: profile.id != null ? String(profile.id) : prev?.id,
          phone: profile.phone,
          name,
          role: dbRoleRaw,
          ...(typeof profile.avatarUrl === 'string' && profile.avatarUrl
            ? { avatarUrl: profile.avatarUrl }
            : {}),
          ...(typeof profile.secondaryPhone === 'string'
            ? { secondaryPhone: profile.secondaryPhone }
            : {}),
        }
      })

      const jwtRole = String(parseAccessTokenPayload(getAccessToken())?.role ?? '').toLowerCase()
      if (dbRole !== jwtRole) {
        const r = await refreshSessionWithCookie()
        if (!cancelled && r.ok && r.data?.user) {
          const u = r.data.user
          if (u && typeof u.phone === 'string') {
            setUser((prev) => ({
              id: u.id != null ? String(u.id) : prev?.id,
              phone: u.phone,
              name:
                typeof u.name === 'string' && u.name.trim()
                  ? u.name
                  : (prev?.name ?? `User ${String(u.phone).slice(-4)}`),
              role: typeof u.role === 'string' ? u.role : dbRoleRaw,
              ...(typeof u.avatarUrl === 'string' && u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
            }))
          }
        } else if (!cancelled && !r.ok) {
          notifySessionDead()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authHydrated, tokenVersion])

  /** Silent refresh ~1 min before access JWT expiry while tab visible. */
  useEffect(() => {
    if (!apiV1Base() || !user || !getAccessToken()) return
    const payload = parseAccessTokenPayload(getAccessToken())
    const exp = typeof payload?.exp === 'number' ? payload.exp : null
    if (exp == null) return
    const ms = exp * 1000 - Date.now() - 60_000
    const delay = Math.max(0, ms)
    const id = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return
      void refreshSessionWithCookie().then((r) => {
        if (!r.ok) notifySessionDead()
      })
    }, delay)
    return () => window.clearTimeout(id)
  }, [user, tokenVersion])

  const sendOtp = useCallback(async (phone) => {
    try {
      const res = await authService.sendOtp(phone)
      const d = res?.data && typeof res.data === 'object' ? res.data : {}
      const data = { sent: d.sent !== false }
      if (typeof d.ttlSeconds === 'number' && d.ttlSeconds > 0) {
        data.ttlSeconds = d.ttlSeconds
      }
      return { ok: true, data }
    } catch (e) {
      if (e?.status === 403) {
        return {
          ok: false,
          message:
            e?.message ||
            (import.meta.env.PROD
              ? 'OTP request was blocked. Verify backend APP_CORS_ALLOWED_ORIGINS includes this frontend domain.'
              : 'You do not have access to this.'),
        }
      }
      return { ok: false, message: e?.message || 'Could not send OTP' }
    }
  }, [])

  const verifyOtp = useCallback(async (phone, otp) => {
    try {
      const res = await authService.verifyOtp(phone, otp)
      const u = res.data?.user
      if (!u) return { ok: false, message: 'Invalid response' }
      const userPhone = typeof u.phone === 'string' ? u.phone : ''
      setUser({
        id: u.id != null ? String(u.id) : '',
        phone: userPhone,
        name:
          typeof u.name === 'string' && u.name.trim()
            ? u.name
            : `User ${userPhone.slice(-4)}`,
        role: typeof u.role === 'string' ? u.role : 'user',
        ...(typeof u.avatarUrl === 'string' && u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
      })
      setModalOpen(false)
      if (typeof u.role === 'string' && u.role === 'delivery') {
        notifyWorkforceAvailabilityChanged()
      }
      return { ok: true, user: u }
    } catch (e) {
      return { ok: false, message: e?.message || 'Verification failed' }
    }
  }, [])

  const signOut = useCallback(async () => {
    const wasDelivery = user?.role === 'delivery'
    await authService.logout()
    setUser(null)
    if (wasDelivery) {
      notifyWorkforceAvailabilityChanged()
    }
  }, [user?.role])

  const patchUser = useCallback((partial) => {
    setUser((u) => (u ? { ...u, ...partial } : u))
  }, [])

  const openAuth = useCallback(() => setModalOpen(true), [])
  const closeAuth = useCallback(() => setModalOpen(false), [])

  const value = useMemo(
    () => ({
      user,
      sessionRole,
      isAdmin,
      authHydrated,
      sendOtp,
      verifyOtp,
      signOut,
      patchUser,
      modalOpen,
      openAuth,
      closeAuth,
    }),
    [
      user,
      sessionRole,
      isAdmin,
      authHydrated,
      sendOtp,
      verifyOtp,
      signOut,
      patchUser,
      modalOpen,
      openAuth,
      closeAuth,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
