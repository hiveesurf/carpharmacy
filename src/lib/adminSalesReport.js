/**
 * Query builder + normalizers for admin sales report.
 */

/**
 * Overview/chart query — never scoped by notSelling (product-list toggle only).
 * @param {Record<string, unknown>} filters
 * @returns {Record<string, string | number | boolean>}
 */
export function buildSalesReportOverviewQuery(filters = {}) {
  const q = {}
  const start = String(filters.startDate ?? '').trim()
  const end = String(filters.endDate ?? '').trim()
  if (start) q.startDate = start
  if (end) q.endDate = end
  const groupBy = String(filters.groupBy ?? 'month').trim().toLowerCase()
  if (groupBy) q.groupBy = groupBy
  q.sort = 'highest'
  q.page = 0
  q.size = 1
  return q
}

/**
 * Product list query — includes notSelling / sort / pagination.
 * @param {Record<string, unknown>} filters
 * @returns {Record<string, string | number | boolean>}
 */
export function buildSalesReportProductsQuery(filters = {}) {
  return buildSalesReportQuery(filters)
}

/**
 * @param {Record<string, unknown>} filters
 * @returns {Record<string, string | number | boolean>}
 */
export function buildSalesReportQuery(filters = {}) {
  const q = {}
  const start = String(filters.startDate ?? '').trim()
  const end = String(filters.endDate ?? '').trim()
  if (start) q.startDate = start
  if (end) q.endDate = end
  const groupBy = String(filters.groupBy ?? 'month').trim().toLowerCase()
  if (groupBy) q.groupBy = groupBy
  if (filters.notSelling) {
    q.notSelling = true
  } else {
    const sort = String(filters.sort ?? 'highest').trim().toLowerCase()
    q.sort = sort === 'lowest' ? 'lowest' : 'highest'
    const sortBy = String(filters.sortBy ?? 'revenue').trim()
    q.sortBy = sortBy === 'unitsSold' ? 'unitsSold' : 'revenue'
  }
  q.page = Number.isFinite(Number(filters.page)) ? Math.max(0, Number(filters.page)) : 0
  q.size = Number.isFinite(Number(filters.size)) ? Math.max(1, Math.min(50, Number(filters.size))) : 20
  return q
}

/**
 * @param {unknown} rows
 */
export function normalizeSalesTimeSeries(rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => ({
      period: String(r?.period ?? ''),
      revenue: Number(r?.revenue ?? 0),
      purchases: Number(r?.unitsSold ?? r?.purchases ?? 0),
    }))
    .filter((r) => r.period)
}

/**
 * @param {unknown} data
 */
export function normalizeSalesReport(data) {
  const d = data && typeof data === 'object' ? data : {}
  const summary = d.summary && typeof d.summary === 'object' ? d.summary : {}
  return {
    summary: {
      totalRevenue: Number(summary.totalRevenue ?? 0),
      totalUnitsSold: Number(summary.totalUnitsSold ?? 0),
    },
    timeSeries: normalizeSalesTimeSeries(d.timeSeries),
    products: Array.isArray(d.products) ? d.products : [],
    page: Number(d.page ?? 0),
    size: Number(d.size ?? 20),
    totalElements: Number(d.totalElements ?? 0),
    hasMore: Boolean(d.hasMore),
  }
}

/**
 * Map a sales-report product row to the shape expected by productListDisplayImageUrl.
 * @param {unknown} row
 */
export function salesReportProductForThumbnail(row) {
  if (!row || typeof row !== 'object') return null
  return {
    name: row.name,
    sku: row.sku,
    imageUrl: row.imageUrl,
    image: row.image ?? row.imageUrl,
    imageKey: row.imageKey,
    metadata: row.metadata,
    gallery: row.gallery,
  }
}
