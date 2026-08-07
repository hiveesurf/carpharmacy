import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiV1Base, refreshSessionWithCookie } from './client.js'
import { clearAccessToken, getAccessToken } from '../lib/authTokens.js'
import { notifySessionDead } from '../lib/sessionEvents.js'
import { toUserFacingApiError } from '../lib/apiUserMessage.js'
import { getApiSessionId } from './session.js'

export function adminDashboard() {
  return apiGet('/admin/dashboard')
}

/**
 * @param {Record<string, string | number | boolean>} [query]
 */
export function adminGetSalesReport(query = {}) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    q.set(key, String(value))
  }
  const qs = q.toString()
  return apiGet(qs ? `/admin/sales-report?${qs}` : '/admin/sales-report')
}

/**
 * @param {Record<string, string | number | boolean>} [query]
 */
export function adminGetReconciliation(query = {}) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    q.set(key, String(value))
  }
  const qs = q.toString()
  return apiGet(qs ? `/admin/reconciliation?${qs}` : '/admin/reconciliation')
}

/**
 * Download reconciliation CSV for the current filters (auth + cookie refresh).
 * @param {Record<string, string | number | boolean>} [query]
 * @returns {Promise<void>}
 */
export async function adminExportReconciliationCsv(query = {}) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (key === 'page' || key === 'size') continue
    q.set(key, String(value))
  }
  const qs = q.toString()
  const path = qs ? `/admin/reconciliation/export?${qs}` : '/admin/reconciliation/export'

  const base = apiV1Base()
  if (!base) {
    const err = new Error('API_UNAVAILABLE')
    err.code = 'API_UNAVAILABLE'
    throw err
  }

  const doFetch = () => {
    const headers = new Headers()
    const at = getAccessToken()
    if (at) headers.set('Authorization', `Bearer ${at}`)
    headers.set('X-Guest-Session', getApiSessionId())
    headers.set('Accept', 'text/csv')
    return fetch(`${base}${path}`, { method: 'GET', credentials: 'include', headers })
  }

  let res = await doFetch()
  if (res.status === 401) {
    const refreshed = await refreshSessionWithCookie()
    if (refreshed) res = await doFetch()
    else {
      clearAccessToken()
      notifySessionDead()
    }
  }

  if (!res.ok) {
    let payload = {}
    try {
      payload = await res.json()
    } catch {
      payload = {}
    }
    const { message, code, requestId } = toUserFacingApiError(payload, res.status)
    const err = new Error(message)
    err.status = res.status
    err.code = code
    err.requestId = requestId
    throw err
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'reconciliation.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * @param {{ page?: number, pageSize?: number, sort?: string, search?: string, lowStockOnly?: boolean }} [query]
 */
export function adminListProducts(query = {}) {
  const page = query.page ?? 0
  const pageSize = query.pageSize ?? 20
  const sort = query.sort ?? 'created_desc'
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort: String(sort),
  })
  const search = String(query.search ?? '').trim()
  if (search) q.set('search', search)
  if (query.lowStockOnly) q.set('lowStockOnly', 'true')
  return apiGet(`/admin/products?${q}`)
}

export function adminGetProduct(id) {
  return apiGet(`/admin/products/${encodeURIComponent(id)}`)
}

export function adminCreateProduct(body) {
  return apiPost('/admin/products', body)
}

export function adminUpdateProduct(id, body) {
  return apiPut(`/admin/products/${encodeURIComponent(id)}`, body)
}

export function adminDeleteProduct(id) {
  return apiDelete(`/admin/products/${encodeURIComponent(id)}`)
}

export function adminPublishProduct(id, published = true) {
  return apiPatch(`/admin/products/${encodeURIComponent(id)}/publish`, { published })
}

export function adminListCategories({ page = 0, size = 5 } = {}) {
  const q = new URLSearchParams()
  q.set('page', String(page))
  q.set('size', String(size))
  return apiGet(`/admin/categories?${q.toString()}`)
}

export function adminCategoriesOverview() {
  return apiGet('/admin/categories/overview')
}

export function adminCreateCategory(body) {
  return apiPost('/admin/categories', body)
}

export function adminUpdateCategory(id, body) {
  return apiPut(`/admin/categories/${encodeURIComponent(id)}`, body)
}

export function adminDeleteCategory(id) {
  return apiDelete(`/admin/categories/${encodeURIComponent(id)}`)
}

export function adminListOrders({ page = 0, size = 5, phone } = {}) {
  const q = new URLSearchParams()
  q.set('page', String(page))
  q.set('size', String(size))
  if (phone) q.set('phone', String(phone))
  return apiGet(`/admin/orders?${q.toString()}`)
}

export function adminGetOrder(id) {
  return apiGet(`/admin/orders/${encodeURIComponent(id)}`)
}

export function adminListCars(query = {}) {
  const q = new URLSearchParams()
  q.set('page', String(query.page ?? 0))
  q.set('size', String(query.size ?? 5))
  if (query.published === true) q.set('published', 'true')
  if (query.brand) q.set('brand', String(query.brand))
  const partName =
    query.partName != null && String(query.partName).trim() !== ''
      ? String(query.partName).trim()
      : ''
  if (partName) q.set('partName', partName)
  const s = q.toString()
  return apiGet(`/admin/cars${s ? `?${s}` : ''}`)
}

export function adminCarsPurchasedSummary() {
  return apiGet('/admin/cars/purchased-summary')
}

export function adminCarFormOptions() {
  return apiGet('/admin/cars/form-options')
}

export function adminGetCar(id) {
  return apiGet(`/admin/cars/${encodeURIComponent(id)}`)
}

export function adminGetCarPartsSummary(id) {
  return apiGet(`/admin/cars/${encodeURIComponent(id)}/parts-summary`)
}

export function adminCreateCar(body) {
  return apiPost('/admin/cars', body)
}

export function adminUpdateCar(id, body) {
  return apiPut(`/admin/cars/${encodeURIComponent(id)}`, body)
}

export function adminDeleteCar(id) {
  return apiDelete(`/admin/cars/${encodeURIComponent(id)}`)
}

export function adminPatchOrderStatus(id, status) {
  return apiPatch(`/admin/orders/${encodeURIComponent(id)}/status`, { status })
}

export function adminListUsers({ page = 0, size = 5, phone, role, createdFrom, createdTo, customerType } = {}) {
  const q = new URLSearchParams()
  q.set('page', String(page))
  q.set('size', String(size))
  const phoneTrim = phone != null && String(phone).trim() !== '' ? String(phone).trim() : ''
  if (phoneTrim) q.set('phone', phoneTrim)
  const roleTrim = role != null && String(role).trim() !== '' ? String(role).trim() : ''
  if (roleTrim) q.set('role', roleTrim)
  const fromTrim =
    createdFrom != null && String(createdFrom).trim() !== '' ? String(createdFrom).trim() : ''
  const toTrim = createdTo != null && String(createdTo).trim() !== '' ? String(createdTo).trim() : ''
  if (fromTrim) q.set('createdFrom', fromTrim)
  if (toTrim) q.set('createdTo', toTrim)
  const customerTypeTrim =
    customerType != null && String(customerType).trim() !== '' ? String(customerType).trim().toLowerCase() : ''
  if (customerTypeTrim && customerTypeTrim !== 'all') q.set('customerType', customerTypeTrim)
  return apiGet(`/admin/users?${q.toString()}`)
}

export function adminGetUser(id) {
  return apiGet(`/admin/users/${encodeURIComponent(id)}`)
}

export function adminGetUserProfile(id) {
  return apiGet(`/admin/users/${encodeURIComponent(id)}/profile`)
}

export function adminListEmployees({ page = 0, size = 5, deleted } = {}) {
  const q = new URLSearchParams()
  q.set('page', String(page))
  q.set('size', String(size))
  if (deleted === true) q.set('deleted', 'true')
  else if (deleted === false) q.set('deleted', 'false')
  return apiGet(`/admin/employees?${q.toString()}`)
}

export function adminEmployeesSummary() {
  return apiGet('/admin/employees/summary')
}

export function adminCreateEmployee(body) {
  return apiPost('/admin/employees', body)
}

export function adminGetMe() {
  return apiGet('/admin/me')
}

export function adminListCustomRoles() {
  return apiGet('/admin/custom-roles')
}

export function adminGetEmployee(phone) {
  return apiGet(`/admin/employees/${encodeURIComponent(phone)}`)
}

export function adminGetEmployeeProfile(phone) {
  return apiGet(`/admin/employees/${encodeURIComponent(phone)}/profile`)
}

/**
 * @param {string} employeeId - Workforce admin UUID or phone (path segment).
 * @param {{ fromDate?: string, toDate?: string, search?: string, page?: number, size?: number }} [query]
 */
export function adminGetEmployeeDeliveryOrders(employeeId, query = {}) {
  const q = new URLSearchParams()
  if (query.fromDate) q.set('fromDate', String(query.fromDate))
  if (query.toDate) q.set('toDate', String(query.toDate))
  if (query.search && String(query.search).trim()) q.set('search', String(query.search).trim())
  q.set('page', String(query.page ?? 0))
  q.set('size', String(query.size ?? 20))
  const s = q.toString()
  return apiGet(`/admin/employees/${encodeURIComponent(employeeId)}/delivery-orders${s ? `?${s}` : ''}`)
}

export function adminUpdateEmployee(phone, body) {
  return apiPut(`/admin/employees/${encodeURIComponent(phone)}`, body)
}

export function adminDeleteEmployee(phone, body = {}) {
  return apiDelete(`/admin/employees/${encodeURIComponent(phone)}`, { json: body })
}

export function adminRestoreEmployee(phone) {
  return apiPost(`/admin/employees/${encodeURIComponent(phone)}/restore`, {})
}

export function adminSetEmployeeAvailability(phone, availability) {
  return apiPatch(`/admin/employees/${encodeURIComponent(phone)}/availability`, { availability })
}

export function adminAssignDelivery(orderId, deliveryAdminEmail) {
  return apiPatch(`/admin/orders/${encodeURIComponent(orderId)}/assign-delivery`, { deliveryAdminEmail })
}

export function adminDeliveryAccept(orderId) {
  return apiPost(`/admin/orders/${encodeURIComponent(orderId)}/delivery/accept`, {})
}

export function adminDeliveryOutForDelivery(orderId) {
  return apiPost(`/admin/orders/${encodeURIComponent(orderId)}/delivery/out-for-delivery`, {})
}

export function adminDeliveryResendOtp(orderId) {
  return apiPost(`/admin/orders/${encodeURIComponent(orderId)}/delivery/resend-otp`, {})
}

export function adminDeliveryVerifyOtp(orderId, otp) {
  return apiPost(`/admin/orders/${encodeURIComponent(orderId)}/delivery/verify-otp`, { otp })
}

export function adminDeliveryUploadProof(orderId, proofPhotoUrl) {
  return apiPost(`/admin/orders/${encodeURIComponent(orderId)}/delivery/proof`, { proofPhotoUrl })
}

export function adminDeliveryMarkDelivered(orderId) {
  return apiPost(`/admin/orders/${encodeURIComponent(orderId)}/delivery/delivered`, {})
}

export function adminDeliveryMarkFailed(orderId, { reason, note }) {
  return apiPost(`/admin/orders/${encodeURIComponent(orderId)}/delivery/failed`, { reason, note })
}

/**
 * @param {{ from?: string, to?: string, month?: string }} [query] - month `yyyy-MM`, from/to `yyyy-MM-dd` (UTC). Backend prefers `month` when set.
 */
export function adminListDeliveryOrders(query = {}) {
  const q = new URLSearchParams()
  if (query.from) q.set('from', String(query.from))
  if (query.to) q.set('to', String(query.to))
  if (query.month) q.set('month', String(query.month))
  const s = q.toString()
  return apiGet(`/admin/delivery/orders${s ? `?${s}` : ''}`)
}

export function adminDeliveryMeSummary() {
  return apiGet('/admin/delivery/me/summary')
}

export function adminSetMyDeliveryAvailability(availability) {
  return apiPatch('/admin/delivery/me/availability', { availability })
}

export function adminProductAudit(id) {
  return apiGet(`/admin/products/${encodeURIComponent(id)}/audit`)
}

/**
 * Bulk-import products from an .xlsx file.
 * Uses XHR for upload-progress support.
 * @param {File} file
 * @param {{ category?: string, onUploadProgress?: (pct: number) => void }} [opts]
 */
export async function adminBulkImportProducts(file, { category, onUploadProgress } = {}) {
  const { uploadWithProgress } = await import('./uploadWithProgress.js')
  const fd = new FormData()
  fd.append('file', file)
  const path = category
    ? `/admin/products/import-excel?category=${encodeURIComponent(category)}`
    : '/admin/products/import-excel'
  return uploadWithProgress(path, fd, { onUploadProgress })
}
