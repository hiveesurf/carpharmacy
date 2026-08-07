import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildReconciliationQuery,
  normalizeReconciliation,
  reconciliationEmptyMessage,
  reconciliationStatusBadge,
} from './adminReconciliation.js'

describe('buildReconciliationQuery', () => {
  it('maps filters to API query params', () => {
    assert.deepEqual(
      buildReconciliationQuery({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        status: 'mismatched',
        search: 'ord-1',
        page: 2,
        size: 10,
      }),
      {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        status: 'mismatched',
        search: 'ord-1',
        page: 2,
        size: 10,
      },
    )
  })

  it('defaults status to all and clamps page/size', () => {
    const q = buildReconciliationQuery({ status: 'nope', page: -1, size: 999 })
    assert.equal(q.status, 'all')
    assert.equal(q.page, 0)
    assert.equal(q.size, 100)
  })
})

describe('normalizeReconciliation', () => {
  it('normalizes empty response to zeros', () => {
    const r = normalizeReconciliation({ summary: {}, rows: [] })
    assert.equal(r.summary.totalOrders, 0)
    assert.equal(r.rows.length, 0)
  })

  it('maps populated rows', () => {
    const r = normalizeReconciliation({
      summary: { totalOrders: 1, unmatchedCount: 1, totalDiscrepancyAmount: 50 },
      rows: [
        {
          orderId: 'o1',
          orderDate: '2026-08-01T00:00:00Z',
          orderAmount: 100,
          paymentAmount: 50,
          difference: 50,
          status: 'mismatched',
          paymentGatewayRef: 'pay_1',
        },
      ],
      hasMore: false,
      totalElements: 1,
    })
    assert.equal(r.rows[0].status, 'mismatched')
    assert.equal(r.summary.unmatchedCount, 1)
  })
})

describe('reconciliationStatusBadge', () => {
  it('renders distinct badges per status', () => {
    assert.equal(reconciliationStatusBadge('matched').label, 'Matched')
    assert.match(reconciliationStatusBadge('matched').className, /emerald/)
    assert.equal(reconciliationStatusBadge('mismatched').label, 'Mismatched')
    assert.match(reconciliationStatusBadge('mismatched').className, /amber/)
    assert.equal(reconciliationStatusBadge('missing_payment').label, 'Missing payment')
    assert.match(reconciliationStatusBadge('missing_payment').className, /flare/)
    assert.equal(reconciliationStatusBadge('orphan_payment').label, 'Orphan payment')
    assert.equal(reconciliationStatusBadge('refunded').label, 'Refunded')
    assert.match(reconciliationStatusBadge('refunded').className, /steel|mist/)
  })
})

describe('reconciliationEmptyMessage', () => {
  it('distinguishes date-range empty from discrepancy-filter empty', () => {
    assert.match(
      reconciliationEmptyMessage({ hasDateFilter: true, status: 'all', hasSearch: false }),
      /date range/i,
    )
    assert.match(
      reconciliationEmptyMessage({
        hasDateFilter: false,
        status: 'mismatched',
        hasSearch: false,
      }),
      /No discrepancies/i,
    )
  })
})
