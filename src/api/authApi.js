import { apiGet, apiPost, refreshSessionWithCookie } from './client.js'

export function sendOtp(phone) {
  return apiPost('/auth/send-otp', { phone }, { skipAuth: true })
}

/** Current user from DB (id, phone, name, role). Requires Bearer access token. */
export function getSessionUser() {
  return apiGet('/auth/me')
}

export function verifyOtp(phone, otp) {
  return apiPost('/auth/verify-otp', { phone, otp }, { skipAuth: true })
}

/** Uses the same single-flight refresh as the rest of the app (Strict Mode–safe). */
export async function refreshToken() {
  const r = await refreshSessionWithCookie()
  if (!r.ok) {
    const err = new Error('Session expired')
    err.status = 401
    throw err
  }
  return { success: true, data: r.data, meta: {} }
}

export function logout() {
  return apiPost('/auth/logout', {}, { skipAuth: true })
}
