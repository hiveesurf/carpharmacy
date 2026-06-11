import * as authApi from '../api/authApi.js'
import { refreshSessionWithCookie, apiV1Base } from '../api/client.js'
import { clearApiSessionId } from '../api/session.js'
import { clearAccessToken, setAccessToken } from '../lib/authTokens.js'

function normalizeOtpPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 10) return digits
  return digits.slice(-10)
}

/** Strip spaces/dashes from pasted OTP before verify. */
function normalizeOtpCode(otp) {
  return String(otp ?? '').replace(/\D/g, '')
}

/** Profile from DB; null if unauthenticated or error. */
export async function fetchSessionUser() {
  if (!apiV1Base()) return null
  try {
    const { data } = await authApi.getSessionUser()
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}

export async function sendOtp(phone) {
  if (!apiV1Base()) {
    throw new Error(
      'API not configured. Use Vite dev (proxies to Spring :8080) or set VITE_API_BASE to your /api/v1 URL.',
    )
  }
  return authApi.sendOtp(normalizeOtpPhone(phone))
}

export async function verifyOtp(phone, otp) {
  if (!apiV1Base()) {
    throw new Error(
      'API not configured. Use Vite dev (proxies to Spring :8080) or set VITE_API_BASE to your /api/v1 URL.',
    )
  }
  const digits = normalizeOtpPhone(phone)
  const code = normalizeOtpCode(otp)
  const res = await authApi.verifyOtp(digits, code)
  setAccessToken(res.data.accessToken)
  clearApiSessionId()
  return res
}

export async function tryRefreshSession() {
  if (!apiV1Base()) return null
  try {
    const r = await refreshSessionWithCookie()
    if (!r.ok) {
      clearAccessToken()
      return null
    }
    return r.data
  } catch {
    clearAccessToken()
    return null
  }
}

export async function logout() {
  if (apiV1Base()) {
    try {
      await authApi.logout()
    } catch {
      /* ignore */
    }
  }
  clearAccessToken()
}
