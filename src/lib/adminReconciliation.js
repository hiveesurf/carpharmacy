/**
 * Query builder + normalizers for admin order↔payment reconciliation.
 */

const STATUS_VALUES = new Set([
  'all',
  'matched',
  'mismatched',
  'missing_payment',
  'orphan_payment',
  'refunded',
])

/**
 * @param {Record<string, unknown>} filters
 * @returns {Record<string, string | number>}
 */
export function buildReconciliationQuery(filters = {}) {
  const q = {}
  const start = String(filters.startDate ?? '').trim()
  const end = String(filters.endDate ?? '').trim()
  if (start) q.startDate = start
  if (end) q.endDate = end
  const status = String(filters.status ?? 'all').trim().toLowerCase()
  q.status = STATUS_VALUES.has(status) ? status : 'all'
  const search = String(filters.search ?? '').trim()
  if (search) q.search = search
  q.page = Number.isFinite(Number(filters.page)) ? Math.max(0, Number(filters.page)) : 0
  q.size = Number.isFinite(Number(filters.size))
    ? Math.max(1, Math.min(100, Number(filters.size)))
    : 20
  return q
}

/**
 * @param {unknown} data
 */
export function normalizeReconciliation(data) {
  const d = data && typeof data === 'object' ? data : {}
  const summary = d.summary && typeof d.summary === 'object' ? d.summary : {}
  return {
    summary: {
      totalOrders: Number(summary.totalOrders ?? 0),
      totalOrderValue: Number(summary.totalOrderValue ?? 0),
      totalPaymentsReceived: Number(summary.totalPaymentsReceived ?? 0),
      totalDiscrepancyAmount: Number(summary.totalDiscrepancyAmount ?? 0),
      unmatchedCount: Number(summary.unmatchedCount ?? 0),
    },
    rows: Array.isArray(d.rows) ? d.rows.map(normalizeRow) : [],
    page: Number(d.page ?? 0),
    size: Number(d.size ?? 20),
    totalElements: Number(d.totalElements ?? 0),
    hasMore: Boolean(d.hasMore),
  }
}

/**
 * @param {unknown} row
 */
function normalizeRow(row) {
  const r = row && typeof row === 'object' ? row : {}
  return {
    orderId: String(r.orderId ?? ''),
    orderDate: String(r.orderDate ?? ''),
    orderAmount: Number(r.orderAmount ?? 0),
    paymentAmount: Number(r.paymentAmount ?? 0),
    difference: Number(r.difference ?? 0),
    status: String(r.status ?? 'matched'),
    paymentGatewayRef: String(r.paymentGatewayRef ?? ''),
  }
}

/**
 * Badge styling for reconciliation status.
 * @param {string} status
 */
export function reconciliationStatusBadge(status) {
  switch (String(status ?? '').toLowerCase()) {
    case 'matched':
      return {
        label: 'Matched',
        className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      }
    case 'mismatched':
      return {
        label: 'Mismatched',
        className: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
      }
    case 'missing_payment':
      return {
        label: 'Missing payment',
        className: 'border-flare/50 bg-flare/10 text-flare',
      }
    case 'orphan_payment':
      return {
        label: 'Orphan payment',
        className: 'border-flare/50 bg-flare/10 text-flare',
      }
    case 'refunded':
      return {
        label: 'Refunded',
        className: 'border-steel/60 bg-steel/20 text-mist',
      }
    default:
      return {
        label: String(status || 'Unknown'),
        className: 'border-steel/60 bg-steel/20 text-mist',
      }
  }
}

/**
 * Empty-state copy for the reconciliation table.
 * @param {{ hasDateFilter: boolean, status: string, hasSearch: boolean, unmatchedOnly?: boolean }} opts
 */
export function reconciliationEmptyMessage({ hasDateFilter, status, hasSearch }) {
  const st = String(status ?? 'all').toLowerCase()
  if (hasSearch) {
    return 'No orders match this search.'
  }
  if (st !== 'all' && st !== 'matched') {
    return 'No discrepancies found for these filters.'
  }
  if (hasDateFilter) {
    return 'No orders in this date range.'
  }
  return 'No orders to reconcile yet.'
}
