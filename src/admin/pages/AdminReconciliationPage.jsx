import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Download,
  IndianRupee,
  Package,
  RefreshCw,
  Scale,
} from 'lucide-react'
import * as adminService from '../../services/adminService.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import {
  buildReconciliationQuery,
  normalizeReconciliation,
  reconciliationEmptyMessage,
  reconciliationStatusBadge,
} from '../../lib/adminReconciliation.js'
import { AdminStatCard } from '../components/AdminStatCard.jsx'

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

function formatOrderDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminReconciliationPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [page, setPage] = useState(0)

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)

  const filters = useMemo(
    () => ({ startDate, endDate, status, search, page, size: 20 }),
    [startDate, endDate, status, search, page],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.getReconciliation(buildReconciliationQuery(filters))
      setReport(normalizeReconciliation(data))
    } catch (e) {
      setError(getFetchErrorMessage(e))
      if (page === 0) setReport(null)
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  useEffect(() => {
    void load()
  }, [load])

  const applySearch = () => {
    setSearch(searchDraft.trim())
    setPage(0)
  }

  const onExport = async () => {
    setExporting(true)
    setError(null)
    try {
      await adminService.exportReconciliationCsv(buildReconciliationQuery({ ...filters, page: 0 }))
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const summary = report?.summary
  const rows = report?.rows ?? []
  const hasDateFilter = Boolean(startDate || endDate)
  const hasSearch = Boolean(search)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-wide text-fog sm:text-3xl">
          Reconciliation
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-mist">
          Compares each order&apos;s total against payment ledger amounts in{' '}
          <span className="font-mono text-[11px] text-fog">payment_transactions</span> (Razorpay /
          COD). Includes draft, cancelled, and refunded orders.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard
          label="Total orders"
          value={loading && !summary ? '…' : (summary?.totalOrders ?? 0)}
          icon={Package}
          accent="text-hud"
          helper={hasDateFilter ? 'Selected date range' : 'All orders in scope'}
        />
        <AdminStatCard
          label="Total order value"
          value={loading && !summary ? '…' : formatInr(summary?.totalOrderValue ?? 0)}
          icon={IndianRupee}
          accent="text-accent"
        />
        <AdminStatCard
          label="Payments received"
          value={loading && !summary ? '…' : formatInr(summary?.totalPaymentsReceived ?? 0)}
          icon={Scale}
          accent="text-emerald-500"
          tone="online"
          helper="Paid / refunded ledger amounts"
        />
        <AdminStatCard
          label="Discrepancy amount"
          value={loading && !summary ? '…' : formatInr(summary?.totalDiscrepancyAmount ?? 0)}
          icon={AlertTriangle}
          accent="text-flare"
          tone="joined"
          helper="Abs. diffs for unmatched rows"
        />
        <AdminStatCard
          label="Unmatched count"
          value={loading && !summary ? '…' : (summary?.unmatchedCount ?? 0)}
          icon={AlertTriangle}
          accent="text-flare"
          tone="joined"
          helper="Mismatched + missing + orphan"
        />
      </div>

      <div className="admin-card flex flex-col gap-3 rounded-2xl p-3 sm:p-4">
        <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:flex-nowrap lg:items-end lg:gap-2">
          <div className="w-full min-w-0 sm:max-w-[11rem] sm:flex-1 sm:basis-0">
            <label htmlFor="reco-start" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
              Start date
            </label>
            <input
              id="reco-start"
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
            <label htmlFor="reco-end" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
              End date
            </label>
            <input
              id="reco-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(0)
              }}
              className={toolbarInputClass}
            />
          </div>
          <div className="w-full min-w-0 sm:w-40">
            <label htmlFor="reco-status" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
              Status
            </label>
            <select
              id="reco-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(0)
              }}
              className={`${toolbarSelectClass} w-full`}
            >
              <option value="all">All</option>
              <option value="matched">Matched</option>
              <option value="mismatched">Mismatched</option>
              <option value="missing_payment">Missing payment</option>
              <option value="orphan_payment">Orphan payment</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div className="w-full min-w-0 sm:max-w-[14rem] sm:flex-1 sm:basis-0">
            <label htmlFor="reco-search" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-mist">
              Search
            </label>
            <input
              id="reco-search"
              type="search"
              value={searchDraft}
              placeholder="Order ID or txn ref"
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applySearch()
                }
              }}
              className={toolbarInputClass}
            />
          </div>
          <div className="flex shrink-0 flex-nowrap items-end gap-2">
            <button type="button" onClick={applySearch} disabled={loading} className={headerBtnSecondary}>
              Search
            </button>
            <button type="button" onClick={() => void load()} disabled={loading} className={headerBtnSecondary}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void onExport()}
              disabled={loading || exporting}
              className={headerBtnSecondary}
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-flare/40 bg-flare-muted px-4 py-3 text-sm text-fog">{error}</div>
      ) : null}

      <section className="admin-card overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-steel/50 px-5 py-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
            Order ↔ payment rows
          </h2>
          {!loading && report ? (
            <span className="font-mono text-[10px] text-mist">
              {report.totalElements} row{report.totalElements === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-steel/50 font-mono text-[10px] uppercase tracking-wider text-mist">
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Order date</th>
                <th className="px-4 py-3 font-medium text-right">Order amount</th>
                <th className="px-4 py-3 font-medium text-right">Payment amount</th>
                <th className="px-4 py-3 font-medium text-right">Difference</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Gateway ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-steel/40">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center font-mono text-xs text-mist">
                    Loading reconciliation…
                  </td>
                </tr>
              ) : null}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-mist">
                    {reconciliationEmptyMessage({ hasDateFilter, status, hasSearch })}
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => {
                const badge = reconciliationStatusBadge(row.status)
                return (
                  <tr key={`${row.orderId}-${row.status}-${row.paymentGatewayRef}`} className="text-mist hover:bg-steel/25">
                    <td className="px-4 py-3">
                      {row.orderId ? (
                        <Link
                          to={`/admin/orders/${encodeURIComponent(row.orderId)}`}
                          className="font-mono text-xs text-accent hover:underline"
                        >
                          {row.orderId}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">{formatOrderDate(row.orderDate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-fog">{formatInr(row.orderAmount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-fog">{formatInr(row.paymentAmount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-fog">{formatInr(row.difference)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.paymentGatewayRef || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {report && (report.page > 0 || report.hasMore) ? (
          <div className="flex items-center justify-center gap-2 border-t border-steel/50 px-5 py-3">
            <button
              type="button"
              disabled={loading || page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className={headerBtnSecondary}
            >
              Previous
            </button>
            <span className="font-mono text-[10px] text-mist">
              Page {page + 1}
              {report.totalElements
                ? ` · ${report.totalElements} total`
                : ''}
            </span>
            <button
              type="button"
              disabled={loading || !report.hasMore}
              onClick={() => setPage((p) => p + 1)}
              className={headerBtnSecondary}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
