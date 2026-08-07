import { getFetchErrorMessage } from './apiErrorMessage.js'

export const ADDRESS_EXISTS_MESSAGE =
  'This address already exists. Please select the existing address or use a different label.'

/** @param {unknown} country */
export function normalizeCountryCode(country) {
  const t = String(country ?? '').trim()
  if (!t) return 'IN'
  const lower = t.toLowerCase()
  if (lower === 'india' || lower === 'in') return 'IN'
  if (t.length === 2) return t.toUpperCase()
  return t.slice(0, 2).toUpperCase()
}

function normText(v) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** @param {Record<string, unknown>} a */
export function addressFingerprint(a) {
  return [
    normText(a.line1),
    normText(a.line2),
    normText(a.city),
    normText(a.state),
    normText(a.pincode),
    normalizeCountryCode(a.country),
  ].join('|')
}

/** @param {Record<string, unknown>} a @param {Record<string, unknown>} b */
export function addressesMatch(a, b) {
  if (!a || !b) return false
  return addressFingerprint(a) === addressFingerprint(b)
}

/**
 * @param {Array<Record<string, unknown>>} list
 * @param {Record<string, unknown>} draft
 */
export function findMatchingAddress(list, draft) {
  if (!Array.isArray(list) || !draft) return null
  return list.find((a) => addressesMatch(a, draft)) ?? null
}

/** @param {unknown} err */
export function isAddressConflictError(err) {
  const status = /** @type {{ status?: number }} */ (err).status
  const code = /** @type {{ payload?: { error?: { code?: string, message?: string } } } } */ (err).payload?.error
    ?.code
  const msg = String(
    /** @type {{ payload?: { error?: { message?: string } } } } */ (err).payload?.error?.message ?? '',
  ).toLowerCase()
  return (
    status === 409 ||
    code === 'CONFLICT' ||
    msg.includes('conflicts with existing') ||
    msg.includes('duplicate')
  )
}

/** @param {unknown} err @param {string} [fallback] */
export function getAddressSaveErrorMessage(err, fallback) {
  if (isAddressConflictError(err)) return ADDRESS_EXISTS_MESSAGE
  return getFetchErrorMessage(err, fallback)
}

/** @param {Record<string, unknown>} form */
export function buildAddressPayload(form) {
  const wantsBusinessGst = Boolean(form.isBusinessPurchase)
  const normalizedGst = String(form.gstNumber ?? '').trim().toUpperCase() || null
  return {
    line1: String(form.line1 ?? '').trim(),
    line2: String(form.line2 ?? '').trim() || null,
    city: String(form.city ?? '').trim(),
    state: String(form.state ?? '').trim() || null,
    pincode: String(form.pincode ?? '').trim(),
    country: normalizeCountryCode(form.country),
    label: String(form.label ?? '').trim() || null,
    gstNumber: wantsBusinessGst ? normalizedGst : null,
    isDefault: Boolean(form.isDefault),
  }
}

/** Indian GSTIN — only applied when the field is non-empty. */
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

/** @param {Record<string, unknown>} form */
export function validateAddressForm(form) {
  if (!String(form.line1 ?? '').trim()) return 'Address line 1 is required.'
  if (!String(form.city ?? '').trim()) return 'City is required.'
  if (!String(form.pincode ?? '').trim()) return 'Pincode is required.'
  const gst = String(form.gstNumber ?? '').trim().toUpperCase()
  if (gst && !GSTIN_RE.test(gst)) {
    return 'Enter a valid 15-character GSTIN, or leave GST Number blank.'
  }
  return null
}
