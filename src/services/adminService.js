import * as adminApi from '../api/adminApi.js'
import { apiV1Base } from '../api/client.js'
import { buildAdminProductUpdateBody } from '../lib/adminProductUpdateBody.js'
import { notifyWorkforceAvailabilityChanged } from '../lib/workforceEvents.js'

export async function dashboard() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDashboard()
  return data
}

/**
 * @param {Record<string, string | number | boolean>} [params]
 */
export async function getSalesReport(params = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetSalesReport(params)
  return data && typeof data === 'object' ? data : {}
}

/**
 * @param {Record<string, string | number | boolean>} [params]
 */
export async function getReconciliation(params = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetReconciliation(params)
  return data && typeof data === 'object' ? data : {}
}

/**
 * @param {Record<string, string | number | boolean>} [params]
 */
export async function exportReconciliationCsv(params = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  await adminApi.adminExportReconciliationCsv(params)
}

/**
 * @param {{ page?: number, pageSize?: number, sort?: string, search?: string, lowStockOnly?: boolean }} [params]
 * @returns {Promise<{ items: unknown[], page: number, pageSize: number, total: number, totalPages: number, lowStockCount: number, lowStockThreshold: number }>}
 */
export async function listProductsPage(params = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminListProducts(params)
  const d = data && typeof data === 'object' ? data : {}
  return {
    items: Array.isArray(d.items) ? d.items : [],
    page: typeof d.page === 'number' ? d.page : 0,
    pageSize: typeof d.pageSize === 'number' ? d.pageSize : 20,
    total: typeof d.total === 'number' ? d.total : 0,
    totalPages: typeof d.totalPages === 'number' ? d.totalPages : 0,
    lowStockCount: typeof d.lowStockCount === 'number' ? d.lowStockCount : 0,
    lowStockThreshold: typeof d.lowStockThreshold === 'number' ? d.lowStockThreshold : 5,
    hasMore:
      typeof d.hasMore === 'boolean'
        ? d.hasMore
        : typeof d.page === 'number' && typeof d.totalPages === 'number'
          ? d.page + 1 < d.totalPages
          : false,
    nextPage:
      typeof d.nextPage === 'number'
        ? d.nextPage
        : typeof d.page === 'number'
          ? d.page + 1
          : 1,
  }
}

export async function getProduct(id) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetProduct(id)
  return data && typeof data === 'object' ? data : null
}

export async function updateProduct(id, body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminUpdateProduct(id, body)
  return data?.product ?? null
}

/**
 * Increases stock via existing PUT /admin/products/:id (loads product first for a safe full body).
 * @param {string} productId
 * @param {number} addQuantity positive integer
 */
export async function addProductStock(productId, addQuantity) {
  const add = Math.floor(Number(addQuantity))
  if (!Number.isFinite(add) || add < 1) {
    throw new Error('Add quantity must be a positive integer (minimum 1).')
  }
  const current = await getProduct(productId)
  if (!current?.id) throw new Error('Product not found')
  const currentStock = Math.max(0, Math.floor(Number(current.totalStock ?? 0)))
  const body = buildAdminProductUpdateBody(current, { totalStock: currentStock + add })
  return updateProduct(productId, body)
}

export async function publishProduct(id, published) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminPublishProduct(id, published)
  return data?.product ?? null
}

export async function removeProduct(id) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  await adminApi.adminDeleteProduct(id)
}

export async function createProduct(body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminCreateProduct(body)
  return data?.product ?? null
}

export async function listCategories() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  let page = 0
  let hasMore = true
  const merged = []
  while (hasMore) {
    const { data } = await adminApi.adminListCategories({ page, size: 50 })
    const d = data && typeof data === 'object' ? data : {}
    const items = Array.isArray(d.items) ? d.items.filter((x) => !x?.deleted) : []
    merged.push(...items)
    hasMore = Boolean(d.hasMore)
    page = typeof d.nextPage === 'number' ? d.nextPage : page + 1
  }
  return merged
}

export async function listCategoriesPage({ page = 0, size = 5 } = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminListCategories({ page, size })
  const d = data && typeof data === 'object' ? data : {}
  return {
    items: Array.isArray(d.items) ? d.items : [],
    page: typeof d.page === 'number' ? d.page : page,
    size: typeof d.size === 'number' ? d.size : size,
    hasMore: Boolean(d.hasMore),
    nextPage: typeof d.nextPage === 'number' ? d.nextPage : page + 1,
  }
}

export async function categoriesOverview() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminCategoriesOverview()
  return data && typeof data === 'object' ? data : { summary: {}, categories: [] }
}

export async function createCategory(name) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminCreateCategory({ name })
  return data?.category ?? null
}

export async function removeCategory(id) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  await adminApi.adminDeleteCategory(id)
}

export async function listOrders({ page = 0, size = 5, phone } = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminListOrders({ page, size, phone })
  const d = data && typeof data === 'object' ? data : {}
  return {
    items: Array.isArray(d.items) ? d.items : [],
    page: typeof d.page === 'number' ? d.page : page,
    size: typeof d.size === 'number' ? d.size : size,
    hasMore: Boolean(d.hasMore),
    nextPage: typeof d.nextPage === 'number' ? d.nextPage : page + 1,
  }
}

export async function getAdminOrder(id) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetOrder(id)
  const d = data && typeof data === 'object' ? data : {}
  return d.order && typeof d.order === 'object' ? d.order : null
}

/** Paginate through admin orders API for aggregate status counts (no new endpoint). */
export async function listAllOrdersForSummary() {
  let page = 0
  let hasMore = true
  const merged = []
  while (hasMore) {
    const result = await listOrders({ page, size: 50 })
    merged.push(...(result.items || []))
    hasMore = Boolean(result.hasMore)
    page = Number.isFinite(result.nextPage) ? result.nextPage : page + 1
  }
  return merged
}

export async function listCars(params = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  let page = 0
  let hasMore = true
  const merged = []
  while (hasMore) {
    const { data } = await adminApi.adminListCars({ ...params, page, size: 50 })
    const d = data && typeof data === 'object' ? data : {}
    const items = Array.isArray(d.items) ? d.items.filter((x) => !x?.deleted) : []
    merged.push(...items)
    hasMore = Boolean(d.hasMore)
    page = typeof d.nextPage === 'number' ? d.nextPage : page + 1
  }
  return merged
}

export async function listCarsPage(params = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminListCars(params)
  const d = data && typeof data === 'object' ? data : {}
  return {
    items: Array.isArray(d.items) ? d.items : [],
    page: typeof d.page === 'number' ? d.page : params.page ?? 0,
    size: typeof d.size === 'number' ? d.size : params.size ?? 5,
    hasMore: Boolean(d.hasMore),
    nextPage: typeof d.nextPage === 'number' ? d.nextPage : (params.page ?? 0) + 1,
  }
}

export async function getPurchasedCarsSummary() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminCarsPurchasedSummary()
  const d = data && typeof data === 'object' ? data : {}
  return {
    purchasedCarsCount:
      typeof d.purchasedCarsCount === 'number'
        ? d.purchasedCarsCount
        : Number(d.purchasedCarsCount) || 0,
  }
}

/**
 * @returns {Promise<{ fuels: { label: string }[], transmissions: { label: string }[] }>}
 */
export async function listCarFormOptions() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminCarFormOptions()
  const d = data && typeof data === 'object' ? data : {}
  return {
    fuels: Array.isArray(d.fuels) ? d.fuels : [],
    transmissions: Array.isArray(d.transmissions) ? d.transmissions : [],
  }
}

export async function getCar(id) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetCar(id)
  return data?.car ?? null
}

export async function getCarPartsSummary(id) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetCarPartsSummary(id)
  return data && typeof data === 'object'
    ? data
    : { carId: id, totalParts: 0, soldPartsCount: 0, parts: [] }
}

export async function createCar(body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminCreateCar(body)
  return data?.car ?? null
}

export async function updateCar(id, body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminUpdateCar(id, body)
  return data?.car ?? null
}

export async function removeCar(id) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  await adminApi.adminDeleteCar(id)
}

export async function patchOrderStatus(id, status) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminPatchOrderStatus(id, status)
  return data?.order ?? null
}

export async function listUsers() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  let page = 0
  let hasMore = true
  const merged = []
  while (hasMore) {
    const { data } = await adminApi.adminListUsers({ page, size: 50 })
    const d = data && typeof data === 'object' ? data : {}
    const items = Array.isArray(d.items) ? d.items : []
    merged.push(...items)
    hasMore = Boolean(d.hasMore)
    page = typeof d.nextPage === 'number' ? d.nextPage : page + 1
  }
  return merged
}

export async function getUserProfile(id) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetUserProfile(id)
  return data && typeof data === 'object' ? data : null
}

export async function getEmployeeProfile(phone) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetEmployeeProfile(phone)
  return data && typeof data === 'object' ? data : null
}

/**
 * @param {string} employeeId - Phone or workforce admin UUID.
 * @param {{ fromDate?: string, toDate?: string, search?: string, page?: number, size?: number }} [params]
 */
export async function getEmployeeDeliveryOrders(employeeId, params = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetEmployeeDeliveryOrders(employeeId, params)
  const d = data && typeof data === 'object' ? data : {}
  const summary = d.summary && typeof d.summary === 'object' ? d.summary : {}
  return {
    summary: {
      assignedCount: typeof summary.assignedCount === 'number' ? summary.assignedCount : Number(summary.assignedCount) || 0,
      shippedCount: typeof summary.shippedCount === 'number' ? summary.shippedCount : Number(summary.shippedCount) || 0,
      deliveredCount:
        typeof summary.deliveredCount === 'number' ? summary.deliveredCount : Number(summary.deliveredCount) || 0,
      deliverySuccessRate:
        typeof summary.deliverySuccessRate === 'number'
          ? summary.deliverySuccessRate
          : Number(summary.deliverySuccessRate) || 0,
    },
    orders: Array.isArray(d.orders) ? d.orders : [],
    page: typeof d.page === 'number' ? d.page : params.page ?? 0,
    size: typeof d.size === 'number' ? d.size : params.size ?? 20,
    totalElements: typeof d.totalElements === 'number' ? d.totalElements : Number(d.totalElements) || 0,
    totalPages: typeof d.totalPages === 'number' ? d.totalPages : Number(d.totalPages) || 0,
    hasNext: Boolean(d.hasNext),
  }
}

export async function listUsersPage({ page = 0, size = 5, phone, role, createdFrom, createdTo, customerType } = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminListUsers({ page, size, phone, role, createdFrom, createdTo, customerType })
  const d = data && typeof data === 'object' ? data : {}
  return {
    items: Array.isArray(d.items) ? d.items : [],
    page: typeof d.page === 'number' ? d.page : page,
    size: typeof d.size === 'number' ? d.size : size,
    hasMore: Boolean(d.hasMore),
    nextPage: typeof d.nextPage === 'number' ? d.nextPage : page + 1,
  }
}

export async function getEmployeesSummary() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminEmployeesSummary()
  const d = data && typeof data === 'object' ? data : {}
  return {
    total: typeof d.total === 'number' ? d.total : 0,
    active: typeof d.active === 'number' ? d.active : 0,
    inactive: typeof d.inactive === 'number' ? d.inactive : 0,
    joinedThisMonth: typeof d.joinedThisMonth === 'number' ? d.joinedThisMonth : 0,
  }
}

export async function listEmployees({ deleted = false } = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  let page = 0
  let hasMore = true
  const merged = []
  while (hasMore) {
    const { data } = await adminApi.adminListEmployees({ page, size: 50, deleted })
    const d = data && typeof data === 'object' ? data : {}
    const items = Array.isArray(d.items) ? d.items : []
    merged.push(...items)
    hasMore = Boolean(d.hasMore)
    page = typeof d.nextPage === 'number' ? d.nextPage : page + 1
  }
  return merged
}

export async function listEmployeesPage({ page = 0, size = 5, deleted = false } = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminListEmployees({ page, size, deleted })
  const d = data && typeof data === 'object' ? data : {}
  return {
    items: Array.isArray(d.items) ? d.items : [],
    page: typeof d.page === 'number' ? d.page : page,
    size: typeof d.size === 'number' ? d.size : size,
    hasMore: Boolean(d.hasMore),
    nextPage: typeof d.nextPage === 'number' ? d.nextPage : page + 1,
  }
}

export async function createEmployee(body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminCreateEmployee(body)
  return data?.employee ?? null
}

export async function getAdminMe() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetMe()
  return data && typeof data === 'object' ? data : null
}

export async function listCustomRoles() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminListCustomRoles()
  const items = data?.items
  return Array.isArray(items) ? items : []
}

export async function getEmployee(phone) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminGetEmployee(phone)
  return data?.employee ?? null
}

export async function updateEmployee(phone, body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminUpdateEmployee(phone, body)
  return data?.employee ?? null
}

export async function removeEmployee(phone, { reason } = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDeleteEmployee(phone, { reason: String(reason ?? '').trim() })
  return data && typeof data === 'object' ? data : { removed: phone }
}

export async function restoreEmployee(phone) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminRestoreEmployee(phone)
  return data?.employee ?? null
}

export async function setEmployeeAvailability(phone, availability) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminSetEmployeeAvailability(phone, availability)
  notifyWorkforceAvailabilityChanged()
  return data?.employee ?? null
}

export async function assignDelivery(orderId, deliveryAdminEmail) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminAssignDelivery(orderId, deliveryAdminEmail)
  return data ?? null
}

export async function deliveryAccept(orderId) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDeliveryAccept(orderId)
  return data?.order ?? null
}

export async function deliveryOutForDelivery(orderId) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDeliveryOutForDelivery(orderId)
  return data?.order ?? null
}

export async function deliveryResendOtp(orderId) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDeliveryResendOtp(orderId)
  return data?.order ?? null
}

export async function deliveryVerifyOtp(orderId, otp) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDeliveryVerifyOtp(orderId, otp)
  return data?.order ?? null
}

export async function deliveryUploadProof(orderId, proofPhotoUrl) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDeliveryUploadProof(orderId, proofPhotoUrl)
  return data?.order ?? null
}

export async function deliveryMarkDelivered(orderId) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDeliveryMarkDelivered(orderId)
  return data?.order ?? null
}

export async function deliveryMarkFailed(orderId, { reason, note }) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDeliveryMarkFailed(orderId, { reason, note })
  return data?.order ?? null
}

/**
 * @param {{ from?: string, to?: string, month?: string }} [query]
 */
export async function listDeliveryOrders(query = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminListDeliveryOrders(query)
  return data?.items ?? []
}

export async function deliveryPartnerSummary() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminDeliveryMeSummary()
  return data && typeof data === 'object' ? data : {}
}

export async function setMyDeliveryAvailability(availability) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminSetMyDeliveryAvailability(availability)
  notifyWorkforceAvailabilityChanged()
  return data?.employee ?? null
}

export async function listProductAudit(id) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminProductAudit(id)
  return data?.items ?? []
}

/**
 * @param {File} file
 * @param {{ category?: string, onUploadProgress?: (pct: number) => void }} [opts]
 * @returns {Promise<import('../api/adminApi.js').ProductImportReport>}
 */
export async function bulkImportProducts(file, opts = {}) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await adminApi.adminBulkImportProducts(file, opts)
  return data ?? {}
}
