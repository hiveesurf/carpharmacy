import { toUserFacingApiError } from '../lib/apiUserMessage.js'
import { clearAccessToken, getAccessToken, setAccessToken } from '../lib/authTokens.js'
import { notifySessionDead } from '../lib/sessionEvents.js'
import { getApiSessionId } from './session.js'

/**
 * @returns {string|null} Base URL including `/api/v1`, or null when static-only.
 */
export function apiV1Base() {
  const envObj = import.meta?.env ?? {}
  const env = envObj.VITE_API_BASE?.trim()
  if (env) {
    const u = env.replace(/\/$/, '')
    return u.endsWith('/api/v1') ? u : `${u}/api/v1`
  }
  if (Boolean(envObj.DEV)) return '/api/v1'
  return null
}

/**
 * One in-flight POST /auth/refresh-token for the whole app.
 * React Strict Mode runs effects twice; without this, parallel refreshes revoke each other's rotated cookie.
 *
 * @returns {Promise<{ ok: boolean, data: object | null }>}
 */
let inflightRefresh = null

export function refreshSessionWithCookie() {
  const base = apiV1Base()
  if (!base) return Promise.resolve({ ok: false, data: null })

  if (!inflightRefresh) {
    inflightRefresh = (async () => {
      try {
        const res = await fetch(`${base}/auth/refresh-token`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Guest-Session': getApiSessionId(),
          },
          body: '{}',
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok || !payload.success) {
          return { ok: false, data: null }
        }
        const at = payload.data?.accessToken
        if (at) setAccessToken(at)
        else {
          return { ok: false, data: null }
        }
        return { ok: true, data: payload.data }
      } catch {
        return { ok: false, data: null }
      } finally {
        inflightRefresh = null
      }
    })()
  }
  return inflightRefresh
}

async function refreshAccessTokenViaCookie() {
  const r = await refreshSessionWithCookie()
  return r.ok
}

/**
 * @param {string} path - begins with `/`
 * @param {RequestInit & { json?: unknown, skipAuth?: boolean, _authRetry?: boolean, _badGatewayRetry?: boolean }} [options]
 */
export async function apiRequest(path, options = {}) {
  const base = apiV1Base()
  if (!base) {
    const err = new Error('API_UNAVAILABLE')
    err.code = 'API_UNAVAILABLE'
    throw err
  }

  const {
    json,
    skipAuth,
    headers: extra = {},
    _authRetry,
    _badGatewayRetry,
    ...init
  } = options

  const buildHeaders = () => {
    const headers = new Headers(extra)
    if (json !== undefined) headers.set('Content-Type', 'application/json')
    if (!skipAuth) {
      const at = getAccessToken()
      if (at) headers.set('Authorization', `Bearer ${at}`)
    }
    headers.set('X-Guest-Session', getApiSessionId())
    return headers
  }

  const doFetch = () =>
    fetch(`${base}${path}`, {
      ...init,
      credentials: 'include',
      headers: buildHeaders(),
      body: json !== undefined ? JSON.stringify(json) : init.body,
    })

  let res = await doFetch()

  if (res.status === 502 && !_badGatewayRetry) {
    await new Promise((r) => setTimeout(r, 400))
    return apiRequest(path, { ...options, _badGatewayRetry: true })
  }

  if (
    res.status === 401 &&
    !skipAuth &&
    !_authRetry &&
    path !== '/auth/refresh-token'
  ) {
    const tokenAt401 = getAccessToken()
    const refreshed = await refreshAccessTokenViaCookie()
    if (refreshed) {
      return apiRequest(path, { ...options, _authRetry: true })
    }
    if (getAccessToken() !== tokenAt401) {
      return apiRequest(path, { ...options, _authRetry: true })
    }
    clearAccessToken()
    notifySessionDead()
  }

  let payload = {}
  try {
    const text = await res.text()
    if (text && text.trim().startsWith('{')) {
      payload = JSON.parse(text)
    }
  } catch {
    payload = {}
  }
  if (!res.ok || !payload.success) {
    const { message, code, requestId } = toUserFacingApiError(payload, res.status)
    const err = new Error(message)
    err.status = res.status
    err.code = code
    err.requestId = requestId
    err.payload = payload
    throw err
  }
  return /** @type {{ success: true, data: unknown, meta: object }} */ (payload)
}

export function apiGet(path, opts) {
  return apiRequest(path, { method: 'GET', ...opts })
}

export function apiPost(path, json, opts) {
  return apiRequest(path, { method: 'POST', json, ...opts })
}

export function apiPut(path, json, opts) {
  return apiRequest(path, { method: 'PUT', json, ...opts })
}

export function apiPatch(path, json, opts) {
  return apiRequest(path, { method: 'PATCH', json, ...opts })
}

export function apiDelete(path, opts) {
  return apiRequest(path, { method: 'DELETE', ...opts })
}
