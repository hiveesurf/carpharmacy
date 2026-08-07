/**
 * Effective availability from an employee API row (`availability` only — not onboarding `status`).
 * @param {{ availability?: string | null } | null | undefined} row
 * @returns {'online' | 'busy' | 'offline' | 'pending'}
 */
export function employeeAvailabilityFromRow(row) {
  return normalizeEmployeeAvailability(row?.availability)
}

/**
 * Workforce availability display (matches backend EmployeeAvailability.effectiveStatus).
 * @param {string | null | undefined} raw
 * @returns {'online' | 'busy' | 'offline' | 'pending'}
 */
export function normalizeEmployeeAvailability(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'pending') return 'pending'
  if (s === 'offline') return 'offline'
  if (s === 'busy') return 'busy'
  if (s === 'online' || s === 'free') return 'online'
  return 'offline'
}

/** @param {string | null | undefined} raw */
export function employeeAvailabilityLabel(raw) {
  const status = normalizeEmployeeAvailability(raw)
  if (status === 'online') return 'Online'
  if (status === 'busy') return 'Busy'
  if (status === 'pending') return 'Pending'
  return 'Offline'
}

/** Uppercase label for compact UI (orders dropdown). */
export function employeeAvailabilityShortLabel(raw) {
  return employeeAvailabilityLabel(raw).toUpperCase()
}

/** @param {string | null | undefined} raw */
export function isEmployeeOnlineForAssignment(raw) {
  return normalizeEmployeeAvailability(raw) === 'online'
}
