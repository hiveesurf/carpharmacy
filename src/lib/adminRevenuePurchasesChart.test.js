import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildRevenuePurchasesLinePath,
  normalizeChartRows,
} from './adminRevenuePurchasesChart.js'

describe('normalizeChartRows', () => {
  it('keeps a single month row (early/test dataset shape)', () => {
    const rows = normalizeChartRows([{ period: '2026-08', revenue: 17397, purchases: 3 }])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].period, '2026-08')
    assert.equal(rows[0].revenue, 17397)
  })
})

describe('buildRevenuePurchasesLinePath', () => {
  const pointAt = (_row, i) => ({ x: i * 10, y: 100 - i * 5 })

  it('single point returns null (markers only — no zero-length line)', () => {
    const rows = normalizeChartRows([{ period: '2026-08', revenue: 17397, purchases: 3 }])
    assert.equal(buildRevenuePurchasesLinePath(rows, pointAt), null)
  })

  it('multi-point dataset emits M then L commands so a line can render', () => {
    const rows = normalizeChartRows([
      { period: '2026-06', revenue: 4000, purchases: 1 },
      { period: '2026-07', revenue: 9000, purchases: 2 },
      { period: '2026-08', revenue: 17397, purchases: 3 },
    ])
    const d = buildRevenuePurchasesLinePath(rows, pointAt)
    assert.ok(d)
    assert.match(d, /^M /)
    assert.match(d, / L /)
    assert.equal((d.match(/ L /g) || []).length, 2)
    assert.equal(d, 'M 0.00 100.00 L 10.00 95.00 L 20.00 90.00')
  })
})
