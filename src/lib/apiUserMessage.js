/**
 * Maps API error envelopes to safe, user-facing copy. Never surfaces stack traces or raw HTML.
 */

const GENERIC =
  'Something went wrong. Please try again in a moment.'
const GENERIC_VALIDATION = 'Please check your input and try again.'
const GENERIC_AUTH = 'Please sign in again to continue.'
const GENERIC_NETWORK = 'We could not reach the server. Check your connection and try again.'

/** @param {string} [text] */
export function looksLikeStackTrace(text) {
  if (text == null || typeof text !== 'string') return false
  const t = text.trim()
  if (t.includes('\n\tat ') || t.includes('\r\n\tat ')) return true
  if (t.includes('Exception:') && t.includes('at ')) return true
  if (/^\s*at\s+[\w.$]+\(/m.test(t)) return true
  return false
}

/**
 * @param {unknown} payload - parsed JSON body (may be empty)
 * @param {number} [httpStatus]
 * @returns {{ message: string, code: string | null, requestId: string | null }}
 */
export function toUserFacingApiError(payload, httpStatus) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const err = /** @type {{ code?: string, message?: string }} */ (p.error ?? {})
  const meta = /** @type {{ requestId?: string }} */ (p.meta ?? {})
  const code = typeof err.code === 'string' ? err.code : null
  let message = typeof err.message === 'string' ? err.message.trim() : ''

  if (looksLikeStackTrace(message)) {
    message = ''
  }

  if (code === 'INTERNAL_ERROR' || httpStatus === 502 || httpStatus === 503) {
    return { message: GENERIC, code, requestId: meta.requestId ?? null }
  }

  if (code === 'VALIDATION_ERROR') {
    const safe = message && !looksLikeStackTrace(message) ? message : ''
    return {
      message: safe || GENERIC_VALIDATION,
      code,
      requestId: meta.requestId ?? null,
    }
  }

  if (code === 'UNAUTHORIZED' || httpStatus === 401) {
    return {
      message: message && !looksLikeStackTrace(message) ? message : GENERIC_AUTH,
      code,
      requestId: meta.requestId ?? null,
    }
  }

  if (code === 'FORBIDDEN' || httpStatus === 403) {
    // Spring CORS/security rejections can surface as bare 403s in production setups.
    const fallback403 =
      !code && !message && import.meta.env.PROD
        ? 'Request was blocked by server policy. For login/OTP, verify backend APP_CORS_ALLOWED_ORIGINS includes this frontend domain.'
        : 'You do not have access to this.'
    return {
      message: message && !looksLikeStackTrace(message) ? message : fallback403,
      code,
      requestId: meta.requestId ?? null,
    }
  }

  if (code === 'RATE_LIMITED' || httpStatus === 429) {
    const details =
      err && typeof err === 'object' && err.details && typeof err.details === 'object'
        ? /** @type {{ retryAfterSeconds?: number }} */ (err.details)
        : {}
    const retryAfter = Number(details.retryAfterSeconds)
    const base =
      message && !looksLikeStackTrace(message)
        ? message
        : 'Too many requests, please wait and try again.'
    const waitHint =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? ` Please wait about ${Math.ceil(retryAfter)} seconds and try again.`
        : ''
    return {
      message: `${base}${waitHint}`,
      code: code || 'RATE_LIMITED',
      requestId: meta.requestId ?? null,
    }
  }

  if (!message) {
    if (httpStatus >= 500) return { message: GENERIC, code, requestId: meta.requestId ?? null }
    if (httpStatus === 404) return { message: 'Not found.', code, requestId: meta.requestId ?? null }
    return { message: 'Request could not be completed.', code, requestId: meta.requestId ?? null }
  }

  return { message, code, requestId: meta.requestId ?? null }
}

/**
 * @param {unknown} err - caught from apiRequest or fetch
 * @param {string} [fallback]
 */
export function getFetchErrorMessage(
  err,
  fallback = 'Could not load this section. Start the API (Spring on :8080) or run npm run dev with the backend running.',
) {
  if (err == null) return fallback

  const payload = /** @type {{ payload?: unknown }} */ (err).payload
  const status = /** @type {{ status?: number }} */ (err).status
  if (payload !== undefined) {
    const { message } = toUserFacingApiError(payload, status)
    if (message) return message
  }

  const msg = typeof err.message === 'string' ? err.message.trim() : ''
  if (msg === 'API_UNAVAILABLE' || msg === 'Failed to fetch' || msg === 'Load failed' || msg === 'NetworkError when attempting to fetch resource.') {
    return GENERIC_NETWORK
  }
  if (looksLikeStackTrace(msg)) return GENERIC
  if (msg) return msg
  return fallback
}
