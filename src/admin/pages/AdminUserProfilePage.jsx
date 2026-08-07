import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Mail,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  ShoppingBag,
  Truck,
  UserRound,
  XCircle,
} from 'lucide-react'
import * as adminService from '../../services/adminService.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import {
  matchesProfileStatusFilter,
  normalizeOrderStatus,
  ORDER_STATUS_FILTER_LABELS,
} from '../../lib/orderStatus.js'
import { resolveApiAssetUrl } from '../../lib/resolveApiAssetUrl.js'
import { ProfileSummaryCard } from '../components/ProfileSummaryCard.jsx'
import { OrderViewDetailsLink } from '../components/AdminOrderDetailsPanels.jsx'

const ORDER_SUMMARY_CARDS = [
  { key: 'recent', label: 'Recent Orders', sublabel: 'Last 7 days', countKey: 'recent', icon: ClipboardList },
  { key: 'placed', label: 'Placed', countKey: 'placed', icon: Package },
  { key: 'pending', label: 'Pending', countKey: 'pending', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', countKey: 'confirmed', icon: CheckCircle2 },
  { key: 'processing', label: 'Processing', countKey: 'processing', icon: Box },
  { key: 'shipped', label: 'Shipped', countKey: 'shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', countKey: 'delivered', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Cancelled', countKey: 'cancelled', icon: XCircle },
  { key: 'refunded', label: 'Refunded', countKey: 'refunded', icon: RotateCcw },
]

/** White card on grey canvas (matches Admin Users page) */
const panel =
  'overflow-hidden rounded-xl border border-[#d5d9d9] bg-white shadow-[0_2px_8px_rgba(15,17,17,0.08)] dark:border-steel/60 dark:bg-slate dark:shadow-none'

const BACK_BTN =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-accent bg-white px-4 py-2 text-sm font-semibold text-accent shadow-sm transition-colors hover:bg-accent-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 dark:bg-slate dark:hover:bg-accent-muted'
const labelClass = 'text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6f7373] dark:text-mist'
const valueClass = 'text-sm font-medium text-[#0f1111] dark:text-fog'

function formatInr(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function formatPaymentMode(method) {
  if (method == null || method === '') return 'Not available'
  const raw = String(method).trim().toLowerCase().replace(/_/g, ' ')
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Not available'
}

function orderStatusPill(status) {
  const s = normalizeOrderStatus(status)
  if (s === 'delivered') return 'bg-[#d5f0e3] text-[#067d62] ring-[#067d62]/20'
  if (s === 'shipped') return 'bg-accent-muted text-accent ring-accent/25'
  if (s === 'processing') return 'bg-[#fef3e8] text-[#c45500] ring-[#c45500]/25'
  if (s === 'confirmed') return 'bg-accent-muted text-accent ring-accent/25'
  if (s === 'draft') return 'bg-[#fef3e8] text-[#c45500] ring-[#c45500]/25'
  if (s === 'cancelled' || s === 'refunded') return 'bg-[#fdecea] text-[#b12704] ring-[#b12704]/20'
  return 'bg-[#f0f2f2] text-[#565959] ring-[#565959]/15'
}

function orderStatusLabel(status) {
  const s = normalizeOrderStatus(status)
  if (s === 'draft') return 'pending'
  return s || '—'
}

function roleBadgeClass(role) {
  const r = String(role ?? 'user').toLowerCase()
  if (r === 'super_admin' || r === 'admin') {
    return 'bg-accent-muted text-accent ring-accent/30'
  }
  return 'bg-[#f0f2f2] text-[#565959] ring-[#565959]/20'
}

function InfoTile({ icon: Icon, label, children, accent }) {
  return (
    <div className="flex gap-3 rounded-md border border-[#e3e6e6] bg-[#fafafa] px-3 py-2.5 dark:border-steel/50 dark:bg-ink/20">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${accent ?? 'bg-accent-muted text-accent'}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={labelClass}>{label}</p>
        <div className={`mt-0.5 ${valueClass}`}>{children}</div>
      </div>
    </div>
  )
}

function EmptyPanel({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-muted text-accent ring-1 ring-accent/25">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-base font-semibold text-[#0f1111] dark:text-fog">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[#565959] dark:text-mist">{description}</p>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className={`${panel} h-40`} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={`${panel} h-48`} />
        <div className={`${panel} h-48`} />
      </div>
      <div className={`${panel} h-64`} />
    </div>
  )
}

export function AdminUserProfilePage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('recent')

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const profile = await adminService.getUserProfile(id)
        if (!cancel) setData(profile)
      } catch (e) {
        if (!cancel) {
          setError(getFetchErrorMessage(e))
          setData(null)
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [id])

  const user = data?.user ?? {}
  const orderCounts = data?.orderCounts ?? {}
  const last7DayCounts = orderCounts.last7Days ?? {}
  const addresses = Array.isArray(data?.addresses) ? data.addresses : []
  const customerOrders = Array.isArray(data?.recentOrders) ? data.recentOrders : []

  const filteredOrders = useMemo(() => {
    return customerOrders.filter((o) => matchesProfileStatusFilter(o?.status, statusFilter))
  }, [customerOrders, statusFilter])

  const avatar = resolveApiAssetUrl(user.avatarUrl)
  const displayName = user.name?.trim() || 'User'
  const initials = displayName.charAt(0).toUpperCase()
  const totalOrders = orderCounts.total ?? 0

  return (
    <div className="-mx-4 min-w-0 rounded-none bg-[#eaeded] px-4 py-5 dark:bg-ink/40 md:-mx-6 md:rounded-xl md:px-6 lg:-mx-0 lg:rounded-xl lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Top navigation */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm" aria-label="Breadcrumb">
            <Link
              to="/admin/users"
              className="font-medium text-accent hover:underline"
            >
              Users
            </Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#aab7b8]" aria-hidden />
            <span className="truncate font-medium text-[#565959] dark:text-mist">User details</span>
          </nav>
          <Link to="/admin/users" className={BACK_BTN}>
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            Back to users
          </Link>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-[#f5a0a0] bg-[#fdecea] px-4 py-3 text-sm text-[#b12704] dark:border-flare/40 dark:bg-flare-muted dark:text-fog"
          >
            {error}
          </div>
        ) : null}

        {loading ? <ProfileSkeleton /> : null}

        {!loading && data ? (
          <>
            {/* User header */}
            <section className={panel}>
              <div className="border-b border-[#e7e7e7] bg-[#fafafa] px-4 py-2.5 dark:border-steel/50 dark:bg-ink/10 sm:px-5">
                <h1 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#565959] dark:text-mist">
                  User overview
                </h1>
              </div>
              <div className="flex flex-col gap-6 p-4 sm:p-5 lg:flex-row lg:items-start lg:gap-8">
                <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="h-20 w-20 rounded-lg border border-[#d5d9d9] object-cover shadow-sm sm:h-24 sm:w-24"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-[#d5d9d9] bg-accent-muted text-2xl font-semibold text-accent shadow-sm ring-1 ring-accent/30 sm:h-24 sm:w-24 sm:text-3xl">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-[#0f1111] dark:text-fog sm:text-2xl">
                        {displayName}
                      </h2>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${roleBadgeClass(user.role)}`}
                      >
                        {user.role || 'user'}
                      </span>
                    </div>
                    <div>
                      <p className={labelClass}>GST NO.</p>
                      <p className="mt-1 w-full max-w-[18rem] rounded border border-[#e3e6e6] bg-[#f7fafa] px-2.5 py-1.5 font-mono text-xs leading-relaxed uppercase text-[#0f1111] dark:border-steel/50 dark:bg-ink/20 dark:text-fog">
                        {user.gstNumber || '—'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="w-full shrink-0 lg:max-w-md xl:max-w-lg">
                  <dl className="grid gap-2.5 sm:grid-cols-2">
                    <InfoTile icon={Phone} label="Phone">
                      <span className="font-mono">{user.phone || '—'}</span>
                    </InfoTile>
                    <InfoTile icon={Mail} label="Email">
                      <span className="truncate">{user.email || '—'}</span>
                    </InfoTile>
                    <InfoTile icon={UserRound} label="Role" accent="bg-[#fef3e8] text-[#c45500] dark:bg-flare-muted dark:text-flare">
                      <span className="uppercase">{user.role || 'user'}</span>
                    </InfoTile>
                    <InfoTile icon={ShoppingBag} label="Total orders" accent="bg-accent-muted text-accent">
                      <span className="text-lg font-semibold tabular-nums">{totalOrders}</span>
                    </InfoTile>
                  </dl>
                </div>
              </div>
            </section>

            {/* Addresses + order summary */}
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
              <section className={`${panel} flex flex-col`}>
                <div className="border-b border-[#e3e6e6] px-4 py-3 dark:border-steel/50 sm:px-5">
                  <h2 className="text-sm font-semibold text-[#0f1111] dark:text-fog">Addresses</h2>
                  <p className="mt-0.5 text-xs text-[#565959] dark:text-mist">
                    {addresses.length === 0
                      ? 'No saved locations'
                      : `${addresses.length} saved address${addresses.length === 1 ? '' : 'es'}`}
                  </p>
                </div>
                <div className="flex-1 p-4 sm:p-5">
                  {addresses.length === 0 ? (
                    <EmptyPanel
                      icon={MapPin}
                      title="No addresses on file"
                      description="This user has not added any delivery addresses yet."
                    />
                  ) : (
                    <ul className="grid gap-3 sm:grid-cols-1">
                      {addresses.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-md border border-[#e3e6e6] bg-[#fafafa] p-3.5 dark:border-steel/50 dark:bg-ink/15"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                              {a.label || 'Address'}
                            </p>
                            {a.isDefault ? (
                              <span className="shrink-0 rounded bg-[#232f3e] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-[#0f1111] dark:text-fog">
                            {[a.line1, a.line2].filter(Boolean).join(', ')}
                          </p>
                          <p className="mt-1 text-sm text-[#565959] dark:text-mist">
                            {[a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                            {a.country ? ` · ${a.country}` : ''}
                          </p>
                          {a.gstNumber ? (
                            <p className="mt-1 text-xs text-[#565959] dark:text-mist">GST: {a.gstNumber}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className={`${panel} flex flex-col`}>
                <div className="border-b border-[#e3e6e6] px-4 py-3 dark:border-steel/50 sm:px-5">
                  <h2 className="text-sm font-semibold text-[#0f1111] dark:text-fog">Order summary</h2>
                  <p className="mt-0.5 text-xs text-[#565959] dark:text-mist">
                    Counts for the last 7 days · select a card to filter the list below
                  </p>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-2.5 p-4 content-start sm:grid-cols-3 sm:p-5 lg:grid-cols-2 xl:grid-cols-3">
                  {ORDER_SUMMARY_CARDS.map((card) => (
                    <ProfileSummaryCard
                      key={card.key}
                      variant="seller"
                      icon={card.icon}
                      label={card.label}
                      sublabel={card.sublabel}
                      value={last7DayCounts[card.countKey] ?? 0}
                      active={statusFilter === card.key}
                      onClick={() => setStatusFilter(card.key)}
                    />
                  ))}
                </div>
              </section>
            </div>

            {/* Customer orders */}
            <section className={`${panel} overflow-hidden`}>
              <div className="flex flex-col gap-3 border-b border-[#e3e6e6] bg-[#fafafa] px-4 py-3 dark:border-steel/50 dark:bg-ink/15 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-[#0f1111] dark:text-fog">Customer orders</h2>
                  <p className="mt-0.5 text-xs text-[#565959] dark:text-mist">
                    Summary only · open an order for payment, address, items, delivery, and timeline ·{' '}
                    {filteredOrders.length} of {customerOrders.length} shown
                    {statusFilter !== 'recent' ? (
                      <>
                        {' '}
                        ·{' '}
                        <span className="font-medium text-accent">
                          {ORDER_STATUS_FILTER_LABELS[statusFilter] ?? statusFilter}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                {statusFilter !== 'recent' ? (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('recent')}
                    className="self-start rounded-lg border border-accent bg-white px-3 py-1.5 text-xs font-semibold text-accent shadow-sm transition-colors hover:bg-accent-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 dark:bg-slate dark:hover:bg-accent-muted"
                  >
                    Clear filter
                  </button>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                {filteredOrders.length === 0 ? (
                  <EmptyPanel
                    icon={Package}
                    title={
                      customerOrders.length === 0 ? 'No orders yet' : 'No orders match this filter'
                    }
                    description={
                      customerOrders.length === 0
                        ? 'This user has not placed any orders.'
                        : `No orders with status “${ORDER_STATUS_FILTER_LABELS[statusFilter] ?? statusFilter}”. Clear the filter or choose another summary card.`
                    }
                  />
                ) : (
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#e3e6e6] bg-[#f0f2f2] text-[10px] font-semibold uppercase tracking-[0.06em] text-[#565959] dark:border-steel/50 dark:bg-ink/20 dark:text-mist">
                        <th className="px-4 py-3 font-semibold sm:px-5">Order ID</th>
                        <th className="px-4 py-3 font-semibold sm:px-5">Status</th>
                        <th className="px-4 py-3 font-semibold sm:px-5">Amount</th>
                        <th className="px-4 py-3 font-semibold sm:px-5">Payment</th>
                        <th className="px-4 py-3 font-semibold sm:px-5">Created</th>
                        <th className="px-4 py-3 font-semibold text-right sm:px-5">Items</th>
                        <th className="px-4 py-3 font-semibold text-right sm:px-5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e3e6e6] dark:divide-steel/40">
                      {filteredOrders.map((o) => (
                        <tr
                          key={o.id}
                          className="bg-white transition-colors hover:bg-accent-muted/40 dark:bg-transparent dark:hover:bg-steel/15"
                        >
                          <td className="px-4 py-3.5 font-mono text-xs sm:px-5">
                            <Link
                              to={`/admin/orders/${encodeURIComponent(o.id)}`}
                              className="font-medium text-accent hover:underline"
                            >
                              {o.id}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5 sm:px-5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${orderStatusPill(o.status)}`}
                            >
                              {orderStatusLabel(o.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-medium tabular-nums text-[#0f1111] dark:text-fog sm:px-5">
                            {formatInr(o.amount)}
                          </td>
                          <td className="px-4 py-3.5 text-[#565959] dark:text-mist sm:px-5">
                            {formatPaymentMode(o.paymentMethod)}
                          </td>
                          <td className="px-4 py-3.5 text-[#565959] dark:text-mist sm:px-5">
                            {formatDate(o.date)}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-[#0f1111] dark:text-fog sm:px-5">
                            {o.itemCount ?? 0}
                          </td>
                          <td className="px-4 py-3.5 text-right sm:px-5">
                            <OrderViewDetailsLink orderId={o.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
