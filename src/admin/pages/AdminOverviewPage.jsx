import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, ShoppingBag, IndianRupee, TrendingUp, Package, Clock, Radio, AlertTriangle, X } from 'lucide-react'
import * as adminService from '../../services/adminService.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import { normalizeChartRows } from '../../lib/adminRevenuePurchasesChart.js'
import { RevenuePurchasesChart } from '../components/RevenuePurchasesChart.jsx'
import { useAuth } from '../../context/useAuth.js'
import { employeeAvailabilityShortLabel, normalizeEmployeeAvailability } from '../../lib/employeeAvailability.js'
import { subscribeWorkforceAvailabilityRefresh } from '../../lib/workforceEvents.js'

function formatInr(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

const statMeta = [
  { key: 'totalUsers', label: 'Users', icon: Users, accent: 'text-hud', to: '/admin/users' },
  { key: 'totalOrders', label: 'Orders', icon: ShoppingBag, accent: 'text-accent', to: '/admin/orders' },
  { key: 'revenue', label: 'Revenue', icon: IndianRupee, accent: 'text-flare', format: formatInr },
  { key: 'purchaseCount', label: 'Items sold', icon: ShoppingBag, accent: 'text-hud', to: '/admin/orders' },
]

function formatCompactInr(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(n))
}

function normalizePartsBreakdown(rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => ({
      category: String(r?.category ?? '').trim(),
      count: Number(r?.count ?? 0),
      revenue: Number(r?.revenue ?? 0),
    }))
    .filter((r) => r.category && (r.revenue > 0 || r.count > 0))
}

const PARTS_PIE_PALETTE = [
  '#ff6b35',
  '#003366',
  '#0d9488',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#64748b',
]

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutSlicePath(cx, cy, outerR, innerR, startAngle, endAngle) {
  const sweep = endAngle - startAngle
  if (sweep <= 0) return ''
  if (sweep >= 359.999) {
    return [
      `M ${cx} ${cy - outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR}`,
      `M ${cx} ${cy - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
      'Z',
    ].join(' ')
  }
  const large = sweep > 180 ? 1 : 0
  const os = polarToCartesian(cx, cy, outerR, endAngle)
  const oe = polarToCartesian(cx, cy, outerR, startAngle)
  const is = polarToCartesian(cx, cy, innerR, startAngle)
  const ie = polarToCartesian(cx, cy, innerR, endAngle)
  return [
    `M ${os.x} ${os.y}`,
    `A ${outerR} ${outerR} 0 ${large} 0 ${oe.x} ${oe.y}`,
    `L ${is.x} ${is.y}`,
    `A ${innerR} ${innerR} 0 ${large} 1 ${ie.x} ${ie.y}`,
    'Z',
  ].join(' ')
}

function CarPartsBreakdownChart({ rows }) {
  const totalRevenue = rows.reduce((sum, r) => sum + Math.max(0, r.revenue), 0)
  const slices = []
  let angle = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const share = totalRevenue > 0 ? row.revenue / totalRevenue : 0
    const sweep = share * 360
    const start = angle
    const end = angle + sweep
    angle = end
    slices.push({
      ...row,
      start,
      end,
      percent: share * 100,
      color: PARTS_PIE_PALETTE[i % PARTS_PIE_PALETTE.length],
    })
  }

  const size = 220
  const cx = size / 2
  const cy = size / 2
  const outerR = 88
  const innerR = 52

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center sm:gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-48 w-48 shrink-0 sm:h-52 sm:w-52" aria-hidden>
        {slices.map((s) => (
          <path
            key={s.category}
            d={donutSlicePath(cx, cy, outerR, innerR, s.start, s.end)}
            fill={s.color}
            className="stroke-slate"
            strokeWidth="1"
          />
        ))}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-fog text-[11px] font-mono font-semibold uppercase tracking-wide"
        >
          Revenue
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-mist text-[10px] font-mono">
          {formatCompactInr(totalRevenue)}
        </text>
      </svg>
      <ul className="w-full min-w-0 space-y-2 text-xs">
        {slices.map((s) => (
          <li key={s.category} className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 text-fog">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="truncate font-sans">{s.category}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-mist">
              {s.percent < 1 && s.percent > 0 ? '<1' : Math.round(s.percent)}% · {formatCompactInr(s.revenue)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatTs(iso) {
  if (iso == null || String(iso).trim() === '') return '—'
  const d = new Date(String(iso))
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString()
}

export function AdminOverviewPage() {
  const { sessionRole } = useAuth()
  const isSales = sessionRole === 'sales'
  const isDelivery = sessionRole === 'delivery'
  const [data, setData] = useState(null)
  const [deliverySummary, setDeliverySummary] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [availabilitySaving, setAvailabilitySaving] = useState(null)
  const [lowStockDismissed, setLowStockDismissed] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        if (isDelivery) {
          const d = await adminService.deliveryPartnerSummary()
          if (!cancel) {
            setDeliverySummary(d && typeof d === 'object' ? d : {})
            setData(null)
          }
        } else {
          const d = await adminService.dashboard()
          if (!cancel) {
            setData(d)
            setDeliverySummary(null)
          }
        }
      } catch (e) {
        if (!cancel) {
          setError(getFetchErrorMessage(e))
          setData(null)
          setDeliverySummary(null)
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [isDelivery])

  const refreshDeliverySummary = useCallback(async () => {
    if (!isDelivery) return
    try {
      const d = await adminService.deliveryPartnerSummary()
      setDeliverySummary(d && typeof d === 'object' ? d : {})
      setError(null)
    } catch (e) {
      setError(getFetchErrorMessage(e))
    }
  }, [isDelivery])

  useEffect(() => {
    if (!isDelivery) return undefined
    const onStats = () => {
      void refreshDeliverySummary()
    }
    window.addEventListener('carnalysys:delivery-stats-refresh', onStats)
    const unsubWorkforce = subscribeWorkforceAvailabilityRefresh(() => {
      void refreshDeliverySummary()
    })
    return () => {
      window.removeEventListener('carnalysys:delivery-stats-refresh', onStats)
      unsubWorkforce()
    }
  }, [isDelivery, refreshDeliverySummary])

  async function setDeliveryAvailability(next) {
    if (!isDelivery || (next !== 'online' && next !== 'offline')) return
    setAvailabilitySaving(next)
    setError(null)
    try {
      const employee = await adminService.setMyDeliveryAvailability(next)
      if (employee && typeof employee === 'object') {
        setDeliverySummary((prev) => ({
          ...(prev && typeof prev === 'object' ? prev : {}),
          availability: employee.availability,
          availabilityStatus: employee.availabilityStatus,
          lastLoginAt: employee.lastLoginAt ?? prev?.lastLoginAt,
          lastLogoutAt: employee.lastLogoutAt ?? prev?.lastLogoutAt,
        }))
      } else {
        await refreshDeliverySummary()
      }
      window.dispatchEvent(new Event('carnalysys:delivery-stats-refresh'))
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setAvailabilitySaving(null)
    }
  }

  if (isDelivery) {
    return (
      <div className="-mx-4 space-y-6 px-4 md:mx-0 md:px-0">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-fog md:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 max-w-xl text-sm text-mist">
            Completed deliveries assigned to you and your last session times.
          </p>
        </div>

        {loading && <p className="font-mono text-xs text-mist">Loading dashboard…</p>}
        {error && (
          <div className="rounded-xl border border-flare/40 bg-flare-muted px-4 py-3 text-sm text-fog">{error}</div>
        )}

        {deliverySummary && !error && (
          <>
            <section className="admin-card relative overflow-hidden p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <Radio className="mt-0.5 h-8 w-8 shrink-0 text-accent opacity-90" strokeWidth={1.5} />
                  <div>
                    <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist">My availability</h2>
                    <p className="mt-2 font-display text-2xl font-bold tracking-tight text-fog">
                      Current status:{' '}
                      <span className="text-accent">
                        {employeeAvailabilityShortLabel(deliverySummary.availability)}
                      </span>
                    </p>
                    <p className="mt-1 max-w-xl text-xs text-mist">
                      Online and Offline are set by you. Busy is set when an order is assigned to you.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    disabled={
                      availabilitySaving !== null ||
                      normalizeEmployeeAvailability(deliverySummary.availability) === 'online'
                    }
                    onClick={() => void setDeliveryAvailability('online')}
                    className="rounded-xl bg-accent px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {availabilitySaving === 'online' ? 'Updating…' : 'Set online'}
                  </button>
                  <button
                    type="button"
                    disabled={
                      availabilitySaving !== null ||
                      normalizeEmployeeAvailability(deliverySummary.availability) === 'offline'
                    }
                    onClick={() => void setDeliveryAvailability('offline')}
                    className="rounded-xl border border-steel/80 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-mist hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {availabilitySaving === 'offline' ? 'Updating…' : 'Set offline'}
                  </button>
                </div>
              </div>
            </section>
            <ul className="grid gap-4 sm:grid-cols-3">
            <li className="admin-card relative overflow-hidden p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist">Deliveries done</p>
                  <p className="mt-2 font-display text-3xl font-bold tabular-nums text-fog">
                    {deliverySummary.deliveriesDone ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-mist">Status delivered · assigned to you</p>
                </div>
                <Package className="h-8 w-8 shrink-0 text-accent opacity-90" strokeWidth={1.5} />
              </div>
            </li>
            <li className="admin-card relative overflow-hidden p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist">Last login</p>
                  <p className="mt-2 font-sans text-sm leading-snug text-fog">{formatTs(deliverySummary.lastLoginAt)}</p>
                </div>
                <Clock className="h-8 w-8 shrink-0 text-hud opacity-90" strokeWidth={1.5} />
              </div>
            </li>
            <li className="admin-card relative overflow-hidden p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist">Last logout</p>
                  <p className="mt-2 font-sans text-sm leading-snug text-fog">{formatTs(deliverySummary.lastLogoutAt)}</p>
                </div>
                <Clock className="h-8 w-8 shrink-0 text-mist opacity-90" strokeWidth={1.5} />
              </div>
            </li>
          </ul>
          </>
        )}
      </div>
    )
  }

  const top = Array.isArray(data?.topProducts) ? data.topProducts : []
  const chartRows = normalizeChartRows(data?.revenueVsPurchases)
  const partsBreakdown = normalizePartsBreakdown(data?.partsBreakdown)
  const stats = statMeta.filter((s) => !(isSales && s.key === 'revenue'))
  const lowStockCount = Number(data?.lowStockCount ?? 0)
  const lowStockThreshold = Number(data?.lowStockThreshold ?? 5)
  const showLowStockAlert =
    !isDelivery &&
    !lowStockDismissed &&
    lowStockCount > 0 &&
    (sessionRole === 'super_admin' || sessionRole === 'sales')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-fog md:text-3xl">
          Analytics
        </h1>
        <p className="mt-1 max-w-xl text-sm text-mist">
          Store performance at a glance. Use the sidebar to manage inventory, categories, and orders — same look as
          the main site.
        </p>
      </div>

      {loading && <p className="font-mono text-xs text-mist">Loading dashboard…</p>}
      {error && (
        <div className="rounded-xl border border-flare/40 bg-flare-muted px-4 py-3 text-sm text-fog">{error}</div>
      )}

      {data && !error && (
        <>
          {showLowStockAlert ? (
            <div className="flex flex-col gap-2 rounded-xl border border-flare/40 bg-flare-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-fog">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-flare" strokeWidth={1.75} aria-hidden />
                <span>
                  <span className="font-medium text-flare">Low stock:</span> {lowStockCount} product
                  {lowStockCount === 1 ? '' : 's'} at or below {lowStockThreshold} units.
                </span>
              </p>
              <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                <Link
                  to="/admin/products?lowStock=1"
                  className="rounded-lg border border-flare/40 bg-ink/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-flare transition-colors hover:bg-flare-muted"
                >
                  Review inventory
                </Link>
                <button
                  type="button"
                  onClick={() => setLowStockDismissed(true)}
                  aria-label="Dismiss low stock warning"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-transparent text-flare transition-colors hover:bg-flare/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-flare/40"
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
          ) : null}

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map(({ key, label, icon: Icon, accent, format, to }) => {
              const raw = data[key]
              const display = format ? format(raw) : String(raw ?? '—')
              const body = (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist">{label}</p>
                    <p className="mt-2 font-display text-2xl font-bold tabular-nums text-fog">{display}</p>
                  </div>
                  <Icon className={`h-8 w-8 shrink-0 opacity-90 ${accent}`} strokeWidth={1.5} />
                </div>
              )
              return (
                <li key={key} className="admin-card relative overflow-hidden p-0">
                  {to ? (
                    <Link
                      to={to}
                      className="block p-5 transition-colors hover:bg-accent-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      aria-label={`Open ${label}`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="p-5">{body}</div>
                  )}
                </li>
              )
            })}
            <li className="relative overflow-hidden rounded-2xl border border-accent/30 bg-accent-muted p-5">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-8 w-8 shrink-0 text-accent" strokeWidth={1.5} />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist">Top catalog</p>
                  <p className="mt-2 text-sm text-mist">
                    Published highlights.{' '}
                    <Link to="/admin/products" className="font-semibold text-accent underline-offset-2 hover:underline">
                      Manage inventory
                    </Link>
                  </p>
                </div>
              </div>
            </li>
          </ul>

          {!isSales ? (
            <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6">
              <section className="admin-card flex min-w-0 flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-steel/50 px-5 py-4">
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
                    Revenue vs items sold (all-time)
                  </h2>
                </div>
                <div className="flex flex-1 flex-col px-5 py-4">
                  {chartRows.length > 0 ? (
                    <RevenuePurchasesChart rows={chartRows} />
                  ) : (
                    <p className="text-sm text-mist">No purchase data available yet.</p>
                  )}
                </div>
              </section>
              <section className="admin-card flex min-w-0 flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-steel/50 px-5 py-4">
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
                    Car parts breakdown
                  </h2>
                </div>
                <div className="flex flex-1 flex-col px-5 py-4">
                  {partsBreakdown.length > 0 ? (
                    <CarPartsBreakdownChart rows={partsBreakdown} />
                  ) : (
                    <p className="text-sm text-mist">No parts data yet.</p>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          <section className="admin-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-steel/50 px-5 py-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-mist">
                Top products (published)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-steel/50 font-mono text-[10px] uppercase tracking-wider text-mist">
                    <th className="px-5 py-3 font-medium">SKU</th>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel/40">
                  {top.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-mist">
                        No products in dashboard sample.
                      </td>
                    </tr>
                  )}
                  {top.map((p) => (
                    <tr key={p.id} className="text-mist hover:bg-steel/25">
                      <td className="px-5 py-3 font-mono text-xs text-mist">{p.sku ?? p.id}</td>
                      <td className="px-5 py-3 font-medium text-fog">{p.name}</td>
                      <td className="px-5 py-3 text-mist">{p.category}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-fog">{formatInr(p.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
