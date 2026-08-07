import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { productListDisplayImageUrl } from './adminProductListStats.js'
import {
  buildSalesReportOverviewQuery,
  buildSalesReportQuery,
  normalizeSalesReport,
  normalizeSalesTimeSeries,
  salesReportProductForThumbnail,
} from './adminSalesReport.js'

describe('buildSalesReportOverviewQuery', () => {
  it('never sends notSelling — chart/KPI overview is independent of product-list toggle', () => {
    const q = buildSalesReportOverviewQuery({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      groupBy: 'month',
      notSelling: true,
    })
    assert.equal(q.notSelling, undefined)
    assert.equal(q.groupBy, 'month')
    assert.equal(q.page, 0)
    assert.equal(q.size, 1)
  })
})

describe('buildSalesReportQuery', () => {
  it('maps filters to API query params', () => {
    assert.deepEqual(
      buildSalesReportQuery({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        groupBy: 'day',
        sort: 'lowest',
        page: 1,
        size: 10,
      }),
      {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        groupBy: 'day',
        sort: 'lowest',
        sortBy: 'revenue',
        page: 1,
        size: 10,
      },
    )
  })

  it('defaults sortBy to revenue when omitted', () => {
    const q = buildSalesReportQuery({ sort: 'highest' })
    assert.equal(q.sortBy, 'revenue')
  })

  it('passes unitsSold sortBy when selected', () => {
    const q = buildSalesReportQuery({ sort: 'highest', sortBy: 'unitsSold' })
    assert.equal(q.sortBy, 'unitsSold')
    assert.equal(q.sort, 'highest')
  })

  it('notSelling omits sort and sortBy params', () => {
    const q = buildSalesReportQuery({ notSelling: true, sort: 'highest', sortBy: 'unitsSold' })
    assert.equal(q.notSelling, true)
    assert.equal(q.sort, undefined)
    assert.equal(q.sortBy, undefined)
  })
})

describe('normalizeSalesReport', () => {
  it('maps unitsSold to chart purchases field', () => {
    const rows = normalizeSalesTimeSeries([{ period: '2026-08', revenue: 100, unitsSold: 3 }])
    assert.equal(rows[0].purchases, 3)
  })

  it('normalizes empty response to zeros', () => {
    const r = normalizeSalesReport({ summary: {}, timeSeries: [], products: [] })
    assert.equal(r.summary.totalRevenue, 0)
    assert.equal(r.products.length, 0)
  })

  it('normalizes populated product rows for table rendering', () => {
    const r = normalizeSalesReport({
      summary: { totalRevenue: 500, totalUnitsSold: 2 },
      timeSeries: [{ period: '2026-08', revenue: 500, unitsSold: 2 }],
      products: [
        {
          productId: 'p1',
          name: 'Widget',
          sku: 'W-1',
          category: 'Engine',
          imageUrl: '/uploads/w.jpg',
          unitsSold: 2,
          revenue: 500,
        },
      ],
      hasMore: false,
      totalElements: 1,
    })
    assert.equal(r.summary.totalUnitsSold, 2)
    assert.equal(r.products[0].name, 'Widget')
    assert.equal(r.timeSeries[0].purchases, 2)
    assert.equal(r.hasMore, false)
  })
})

describe('salesReportProductForThumbnail', () => {
  it('uses populated imageUrl for display', () => {
    const url = productListDisplayImageUrl(
      salesReportProductForThumbnail({
        name: 'Widget',
        imageUrl: 'https://cdn.example.com/w.jpg',
      }),
    )
    assert.equal(url, 'https://cdn.example.com/w.jpg')
  })

  it('falls back to catalog imageKey when imageUrl is missing', () => {
    const url = productListDisplayImageUrl(
      salesReportProductForThumbnail({
        name: 'Brake pad',
        imageKey: 'brakes',
      }),
    )
    assert.ok(url)
    assert.match(url, /\/images\//)
  })

  it('returns null when no image sources exist', () => {
    const url = productListDisplayImageUrl(
      salesReportProductForThumbnail({ name: 'No image part', sku: 'X-1' }),
    )
    assert.equal(url, null)
  })
})
