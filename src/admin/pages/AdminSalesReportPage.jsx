import { useCallback, useEffect, useMemo, useState } from 'react'
import { IndianRupee, Package, RefreshCw } from 'lucide-react'
import * as adminService from '../../services/adminService.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import {
  buildSalesReportOverviewQuery,
  buildSalesReportProductsQuery,
  normalizeSalesReport,
  salesReportProductForThumbnail,
} from '../../lib/adminSalesReport.js'
import { productListDisplayImageUrl } from '../../lib/adminProductListStats.js'
import { AdminStatCard } from '../components/AdminStatCard.jsx'
import { RevenuePurchasesChart } from '../components/RevenuePurchasesChart.jsx'

const headerBtnSecondary =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-steel/80 bg-ink/30 px-3 font-mono text-[10px] font-medium uppercase tracking-wider text-fog transition-colors hover:border-accent/50 hover:bg-accent/5 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50'

const toolbarSelectClass =
  'h-9 rounded-xl border border-steel/80 bg-ink/40 px-3 font-mono text-[10px] uppercase tracking-wider text-fog focus:border-accent/50 focus:outline-none'

const toolbarInputClass =
  'h-9 w-full min-w-0 rounded-xl border border-steel/80 bg-ink/40 px-3 font-mono text-[10px] text-fog focus:border-accent/50 focus:outline-none'

function formatInr(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v)
}

function SalesReportProductThumb({ row, className = 'h-10 w-10 shrink-0' }) {
  const [broken, setBroken] = useState(false)
  const src = productListDisplayImageUrl(salesReportProductForThumbnail(row))
  const alt = row?.name || row?.sku || 'Product'

  if (!src || broken) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-lg border border-steel/50 bg-ink/30`}
        aria-hidden
      >
        <Package className="h-4 w-4 text-mist/70" strokeWidth={1.5} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={`${className} rounded-lg border border-steel/40 object-cover bg-ink/20`}
    />
  )
}

export function AdminSalesReportPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [groupBy, setGroupBy] = useState('month')
  const [sort, setSort] = useState('highest')
  const [sortBy, setSortBy] = useState('revenue')
  const [notSelling, setNotSelling] = useState(false)
  const [page, setPage] = useState(0)

  const [overview, setOverview] = useState(null)
  const [productReport, setProductReport] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [error, setError] = useState(null)

  const overviewFilters = useMemo(
    () => ({ startDate, endDate, groupBy }),
    [startDate, endDate, groupBy],
  )

  const productFilters = useMemo(
    () => ({ startDate, endDate, groupBy, sort, sortBy, notSelling, page, size: 20 }),
    [startDate, endDate, groupBy, sort, sortBy, notSelling, page],
  )

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    setError(null)
    try {
      const data = await adminService.getSalesReport(buildSalesReportOverviewQuery(overviewFilters))
      const normalized = normalizeSalesReport(data)
      setOverview({
        summary: normalized.summary,
        timeSeries: normalized.timeSeries,
      })
    } catch (e) {
      setError(getFetchErrorMessage(e))
      setOverview(null)
    } finally {
      setOverviewLoading(false)
    }
  }, [overviewFilters])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    setError(null)
    try {
      const data = await adminService.getSalesReport(buildSalesReportProductsQuery(productFilters))
      const normalized = normalizeSalesReport(data)
      setProductReport((prev) => {
        if (page === 0 || !prev) return normalized
        return {
          ...normalized,
          products: [...prev.products, ...normalized.products],
        }
      })
    } catch (e) {
      setError(getFetchErrorMessage(e))
      if (page === 0) setProductReport(null)
    } finally {
      setProductsLoading(false)
    }
  }, [productFilters, page])

  const refreshAll = useCallback(() => {
    void loadOverview()
    void loadProducts()
  }, [loadOverview, loadProducts])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const chartRows = overview?.timeSeries ?? []
  const products = productReport?.products ?? []
  const hasDateFilter = Boolean(startDate || endDate)
  const loading = overviewLoading || productsLoading

  const chartEmptyMessage = hasDateFilter
    ? 'No qualifying sales in this date range.'
    : 'No qualifying sales yet (draft, cancelled, and refunded orders are excluded).'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-wide text-fog sm:text-3xl">
          Sales report
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-mist">
          Revenue and units sold by product, with day/month/year trends. Excludes draft, cancelled, and refunded orders.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard
          label="Total revenue"
          value={overviewLoading ? '…' : formatInr(overview?.summary?.totalRevenue ?? 0)}
          icon={IndianRupee}
          accent="text-flare"
          tone="joined"
          helper={hasDateFilter ? 'Selected date range' : 'All-time (qualifying orders)'}
        />
        <AdminStatCard
          label="Units sold"
          value={overviewLoading ? '…' : (overview?.summary?.totalUnitsSold ?? 0)}
          icon={Package}
          accent="text-hud"
          helper="Sum of line quantities"
        />
      </div>

      <div className="admin-card flex flex-col gap-3 rounded-2xl p-3 sm:p-4">
        <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-2">
          <div className="w-full min-w-0 sm:max-w-[11rem] sm:flex-1 sm:basis-0">
            <label htmlFor="sales-start" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
              Start date
            </label>
            <input
              id="sales-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(0)
              }}
              className={toolbarInputClass}
            />
          </div>
          <div className="w-full min-w-0 sm:max-w-[11rem] sm:flex-1 sm:basis-0">
            <label htmlFor="sales-end" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
              End date
            </label>
            <input
              id="sales-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(0)
              }}
              className={toolbarInputClass}
            />
          </div>
          <div className="w-full min-w-0 sm:w-28">
            <label htmlFor="sales-group" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
              Group by
            </label>
            <select
              id="sales-group"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className={`${toolbarSelectClass} w-full`}
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </div>
          {!notSelling ? (
            <>
              <div className="w-full min-w-0 sm:w-36">
                <label htmlFor="sales-sort-by" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
                  Sort by
                </label>
                <select
                  id="sales-sort-by"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value)
                    setPage(0)
                  }}
                  className={`${toolbarSelectClass} w-full`}
                >
                  <option value="revenue">Revenue</option>
                  <option value="unitsSold">Units sold</option>
                </select>
              </div>
              <div className="w-full min-w-0 sm:w-32">
                <label htmlFor="sales-sort" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
                  Sort
                </label>
                <select
                  id="sales-sort"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value)
                    setPage(0)
                  }}
                  className={`${toolbarSelectClass} w-full`}
                >
                  <option value="highest">Highest sales</option>
                  <option value="lowest">Lowest sales</option>
                </select>
              </div>
            </>
          ) : null}
          <div className="flex shrink-0 flex-nowrap items-end gap-2">
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-steel/80 bg-ink/40 px-3 font-mono text-[10px] uppercase tracking-wider text-fog">
              <input
                type="checkbox"
                checked={notSelling}
                onChange={(e) => {
                  setNotSelling(e.target.checked)
                  setPage(0)
                }}
                className="rounded border-steel/80"
              />
              Non-selling
            </label>
            <button type="button" onClick={refreshAll} disabled={loading} className={headerBtnSecondary}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-flare/40 bg-flare-muted px-4 py-3 text-sm text-fog">{error}</div>
      ) : null}

      <section className="admin-card overflow-hidden rounded-2xl">
        <div className="border-b border-steel/50 px-5 py-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist">Revenue over time</h2>
        </div>
        <div className="px-5 py-4">
          {overviewLoading && chartRows.length === 0 ? (
            <p className="font-mono text-xs text-mist">Loading chart…</p>
          ) : chartRows.length > 0 ? (
            <RevenuePurchasesChart rows={chartRows} compact />
          ) : (
            <p className="text-sm text-mist">{chartEmptyMessage}</p>
          )}
        </div>
      </section>

      <section className="admin-card overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-steel/50 px-5 py-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
            {notSelling ? 'Non-selling products' : 'Product sales'}
          </h2>
          {!productsLoading && productReport ? (
            <span className="font-mono text-[10px] text-mist">
              {productReport.totalElements} product{productReport.totalElements === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-steel/50 font-mono text-[10px] uppercase tracking-wider text-mist">
                <th className="w-16 px-4 py-3 font-medium">Photo</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th
                  className={`px-4 py-3 font-medium text-right ${
                    !notSelling && sortBy === 'unitsSold' ? 'text-accent' : ''
                  }`}
                  aria-sort={
                    !notSelling && sortBy === 'unitsSold'
                      ? sort === 'lowest'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  Units{!notSelling && sortBy === 'unitsSold' ? (sort === 'lowest' ? ' ↑' : ' ↓') : ''}
                </th>
                <th
                  className={`px-4 py-3 font-medium text-right ${
                    !notSelling && sortBy === 'revenue' ? 'text-accent' : ''
                  }`}
                  aria-sort={
                    !notSelling && sortBy === 'revenue'
                      ? sort === 'lowest'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  Revenue{!notSelling && sortBy === 'revenue' ? (sort === 'lowest' ? ' ↑' : ' ↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel/40">
              {productsLoading && products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center font-mono text-xs text-mist">
                    Loading products…
                  </td>
                </tr>
              ) : null}
              {!productsLoading && products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-mist">
                    {notSelling
                      ? hasDateFilter
                        ? 'All catalog products had sales in this date range.'
                        : 'Every active product has sold at least once.'
                      : hasDateFilter
                        ? 'No product sales in this date range.'
                        : 'No qualifying sales yet.'}
                  </td>
                </tr>
              ) : null}
              {products.map((p) => (
                <tr key={p.productId} className="text-mist hover:bg-steel/25">
                  <td className="px-4 py-3">
                    <SalesReportProductThumb row={p} />
                  </td>
                  <td className="px-4 py-3 font-medium text-fog">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-fog">{p.unitsSold ?? 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent">{formatInr(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {productReport?.hasMore ? (
          <div className="border-t border-steel/50 px-5 py-3 text-center">
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={productsLoading}
              className={headerBtnSecondary}
            >
              Load more
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
