import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Package } from 'lucide-react'
import { publicUrl } from '../lib/publicUrl'
import { useAuth } from '../context/useAuth'
import { useNotifications } from '../context/useNotifications.js'
import * as orderService from '../services/orderService.js'
import { retryRazorpayPayment } from '../lib/checkoutFlow.js'
import { canRetryOnlinePayment, formatOrderPaymentLabel } from '../lib/orderPaymentNormalize.js'
import { getFetchErrorMessage } from '../lib/apiErrorMessage.js'
import { apiV1Base } from '../api/client.js'
import {
  deliveryStageLabel,
  deliveryTimelineSteps,
  shouldShowCustomerDeliverySection,
} from '../lib/deliveryStage.js'
import { CustomerDeliveryOtpBlock } from '../components/orders/CustomerDeliveryOtpBlock.jsx'
import { telHref, whatsAppHref } from '../lib/deliveryLinks.js'

const ORDER_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'placed', label: 'Placed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'refund', label: 'Refund' },
]
const PAGE_SIZE = 3

function formatInr(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

function statusStyle(s) {
  switch (s) {
    case 'delivered':
      return 'bg-accent-muted text-accent ring-accent/35'
    case 'cancelled':
    case 'refunded':
      return 'bg-flare-muted text-flare ring-flare/30'
    case 'shipped':
    case 'processing':
    case 'confirmed':
      return 'bg-hud/15 text-hud ring-hud/35'
    default:
      return 'bg-steel/50 text-mist ring-steel/60'
  }
}

function paymentStatusStyle(order) {
  const paymentStatus = String(order?.paymentStatus || '').toLowerCase()
  const attempt = String(order?.latestPaymentAttempt?.status || '').toLowerCase()
  if (paymentStatus === 'paid' || paymentStatus === 'authorized') {
    return 'bg-accent-muted text-accent ring-accent/35'
  }
  if (paymentStatus === 'failed' || paymentStatus === 'cancelled' || attempt === 'failed' || attempt === 'cancelled') {
    return 'bg-flare-muted text-flare ring-flare/30'
  }
  if (paymentStatus === 'refunded') {
    return 'bg-hud/15 text-hud ring-hud/35'
  }
  return 'bg-steel/50 text-mist ring-steel/60'
}

export function OrdersPage() {
  const { user, authHydrated, openAuth } = useAuth()
  const [searchParams] = useSearchParams()
  const { items: notifications } = useNotifications()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedOrderId, setExpandedOrderId] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextPage, setNextPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [retryingOrderId, setRetryingOrderId] = useState(null)
  const [retryError, setRetryError] = useState(null)
  const [retryErrorOrderId, setRetryErrorOrderId] = useState(null)
  const [detailRefreshingId, setDetailRefreshingId] = useState(null)
  const apiOn = Boolean(apiV1Base())

  const refreshOrderDetail = useCallback(
    async (orderId) => {
      if (!apiOn || !orderId) return null
      const fresh = await orderService.getOrder(orderId)
      setItems((prev) => prev.map((row) => (row.id === orderId ? { ...row, ...fresh } : row)))
      return fresh
    },
    [apiOn],
  )

  const filteredItems = items.filter((o) => {
    const status = String(o?.status || '').toLowerCase()
    if (statusFilter === 'all') return true
    if (statusFilter === 'refund') return status === 'refund' || status === 'refunded'
    if (statusFilter === 'placed') return status === 'placed' || status === 'created' || status === 'confirmed'
    if (statusFilter === 'delivered') return status === 'delivered' || status === 'deliverd'
    return status === statusFilter
  })
  const orderNotifications = notifications.filter(
    (n) => n?.topic === 'order_status' || n?.topic === 'payment' || n?.sourceType === 'order',
  )

  async function focusOrder(orderId) {
    if (!orderId) return
    setExpandedOrderId(orderId)
    setDetailRefreshingId(orderId)
    try {
      await refreshOrderDetail(orderId)
    } catch {
      /* list row still usable */
    } finally {
      setDetailRefreshingId(null)
    }
    window.setTimeout(() => {
      const el = document.getElementById(`order-${orderId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }

  async function handleOrderToggle(orderId) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null)
      return
    }
    setExpandedOrderId(orderId)
    setDetailRefreshingId(orderId)
    try {
      await refreshOrderDetail(orderId)
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setDetailRefreshingId(null)
    }
  }

  const load = useCallback(async () => {
    if (!apiOn || !user) return
    setLoading(true)
    setError(null)
    try {
      const result = await orderService.listOrders({ page: 0, size: PAGE_SIZE })
      setItems(result.items || [])
      setHasMore(Boolean(result.hasMore))
      setNextPage(Number.isFinite(result.nextPage) ? result.nextPage : 1)
    } catch (e) {
      setError(getFetchErrorMessage(e))
      setItems([])
      setHasMore(false)
      setNextPage(1)
    } finally {
      setLoading(false)
    }
  }, [apiOn, user])

  const loadMore = useCallback(async () => {
    if (!apiOn || !user || !hasMore || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const result = await orderService.listOrders({ page: nextPage, size: PAGE_SIZE })
      setItems((prev) => [...prev, ...(result.items || [])])
      setHasMore(Boolean(result.hasMore))
      setNextPage(Number.isFinite(result.nextPage) ? result.nextPage : nextPage + 1)
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }, [apiOn, user, hasMore, loadingMore, nextPage])

  useEffect(() => {
    if (!authHydrated) return
    if (!user) {
      setLoading(false)
      return
    }
    void load()
  }, [authHydrated, user, load])

  useEffect(() => {
    const onFocus = () => {
      if (user && apiOn) void load()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user, apiOn, load])

  useEffect(() => {
    const orderId = searchParams.get('focusOrder')
    if (!orderId || items.length === 0) return
    if (items.some((o) => o.id === orderId)) {
      focusOrder(orderId)
    }
  }, [searchParams, items])

  async function retryPayment(order) {
    if (!canRetryOnlinePayment(order)) return
    setRetryingOrderId(order.id)
    setRetryError(null)
    setRetryErrorOrderId(null)
    try {
      await retryRazorpayPayment({ order, user })
    } catch (e) {
      setRetryError(getFetchErrorMessage(e))
      setRetryErrorOrderId(order.id)
    } finally {
      await load()
      setRetryingOrderId(null)
    }
  }

  if (!authHydrated) {
    return (
      <div className="min-h-svh bg-slate pt-[calc(var(--nav-h)+2rem)] text-center text-mist">
        <p className="font-sans text-sm">Loading…</p>
      </div>
    )
  }

  if (!user) {
    openAuth()
    return (
      <div className="min-h-svh bg-slate pt-[calc(var(--nav-h)+2rem)] text-center text-mist">
        <p className="font-sans text-sm">Sign in to view your orders.</p>
      </div>
    )
  }

  if (!apiOn) {
    return (
      <div className="min-h-svh bg-slate pt-[calc(var(--nav-h)+2rem)] text-center text-mist">
        <p className="font-sans text-sm">Orders require the API. Set VITE_API_BASE or run the backend.</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-slate pt-[calc(var(--nav-h)+1rem)] pb-20">
      <img
        src={publicUrl('images/engine.jpg')}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15"
        loading="lazy"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-slate/85" aria-hidden />
      <div className="relative z-[1] mx-auto max-w-3xl px-4">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-hud transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          Back to home
        </Link>

        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-hud">Shop</p>
            <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-wide text-fog">
              My orders
            </h1>
            <p className="mt-2 font-sans text-sm text-mist">
              Status updates when the team processes your order. Refresh or return here to see the latest.
            </p>
          </div>
          <Link
            to="/account"
            className="rounded-xl border border-steel/80 px-4 py-2 font-sans text-xs font-semibold text-fog transition-colors hover:border-accent/40"
          >
            Account & addresses
          </Link>
        </header>

        {orderNotifications.length > 0 ? (
          <div className="mb-5 rounded-2xl border border-hud/35 bg-hud/10 p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-hud">Recent updates</p>
            <ul className="space-y-2">
              {orderNotifications.slice(0, 3).map((n) => (
                <li key={n.id} className="rounded-lg border border-steel/50 bg-slate/35 px-3 py-2">
                  <p className="text-xs font-semibold text-fog">{n.title}</p>
                  <p className="mt-0.5 text-xs text-mist">{n.body}</p>
                  {n?.sourceId ? (
                    <button
                      type="button"
                      onClick={() => focusOrder(String(n.sourceId))}
                      className="mt-2 font-sans text-[11px] font-semibold text-accent hover:underline"
                    >
                      Open this order timeline
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {ORDER_STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    active
                      ? 'border-accent/50 bg-accent/20 text-accent'
                      : 'border-steel/70 bg-ink/60 text-mist hover:border-hud/50 hover:text-fog'
                  }`}
                  aria-pressed={active}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        ) : null}

        {loading ? (
          <p className="font-sans text-sm text-mist">Loading orders…</p>
        ) : error ? (
          <p className="font-sans text-sm text-flare">{error}</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-steel/70 bg-ink/95 p-10 text-center shadow-lg backdrop-blur-sm">
            <Package className="mx-auto h-12 w-12 text-mist" strokeWidth={1.25} />
            <p className="mt-4 font-sans text-fog">No orders yet.</p>
            <Link
              to="/catalog"
              className="mt-4 inline-block font-sans text-sm font-semibold text-accent hover:underline"
            >
              Browse catalog
            </Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-steel/70 bg-ink/95 p-8 text-center shadow-lg backdrop-blur-sm">
            <p className="font-sans text-sm text-mist">No orders found for this status.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-5">
              {filteredItems.map((o) => {
              const expanded = expandedOrderId === o.id
              return (
                <li
                  key={o.id}
                  id={`order-${o.id}`}
                  className="overflow-hidden rounded-2xl border border-steel/70 bg-ink/95 shadow-lg backdrop-blur-sm"
                >
                  <button
                    type="button"
                    className="flex w-full flex-col gap-3 border-b border-steel/50 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
                    onClick={() => void handleOrderToggle(o.id)}
                    aria-expanded={expanded}
                  >
                    <div>
                      <p className="font-mono text-xs text-mist">{o.id}</p>
                      <p className="mt-1 text-sm text-mist">
                        {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ring-1 ${statusStyle(o.status)}`}
                      >
                        {o.status}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ring-1 ${paymentStatusStyle(o)}`}
                      >
                        Payment: {formatOrderPaymentLabel(o)}
                      </span>
                      <span className="font-display text-lg font-bold tabular-nums text-fog">{formatInr(o.total)}</span>
                      <ChevronDown
                        className={`h-4 w-4 text-mist transition-transform ${expanded ? 'rotate-180' : ''}`}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </div>
                  </button>
                  {expanded ? (
                    <>
                      {retryError && retryErrorOrderId === o.id ? (
                        <p className="mx-5 mt-3 rounded-lg border border-flare/40 bg-flare-muted px-3 py-2 text-xs text-fog">
                          {retryError}
                        </p>
                      ) : null}
                      <div className="overflow-x-auto px-5 py-3">
                        <table className="w-full min-w-[320px] text-left text-sm">
                          <thead>
                            <tr className="font-mono text-[10px] uppercase tracking-wider text-mist">
                              <th className="py-2 font-medium">Item</th>
                              <th className="py-2 font-medium text-right">Qty</th>
                              <th className="py-2 font-medium text-right">Line</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-steel/40 text-mist">
                            {(o.lines || []).map((line, i) => (
                              <tr key={`${o.id}-${i}`}>
                                <td className="py-2 pr-2">
                                  <span className="font-medium text-fog">{line.productName || line.productId}</span>
                                  {line.sku ? (
                                    <span className="mt-0.5 block font-mono text-[10px] text-mist">{line.sku}</span>
                                  ) : null}
                                </td>
                                <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                                <td className="py-2 text-right tabular-nums text-fog">{formatInr(line.lineTotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {shouldShowCustomerDeliverySection(o) ? (
                        <div className="border-t border-steel/40 px-5 py-4">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="font-mono text-[10px] uppercase tracking-wider text-hud">Delivery</p>
                            <button
                              type="button"
                              disabled={detailRefreshingId === o.id}
                              onClick={() => void refreshOrderDetail(o.id)}
                              className="font-sans text-[11px] font-semibold text-accent hover:underline disabled:opacity-50"
                            >
                              {detailRefreshingId === o.id ? 'Refreshing…' : 'Refresh delivery'}
                            </button>
                          </div>
                          {o.deliveryPartner ? (
                            <div className="mb-3 rounded-lg border border-steel/50 bg-slate/30 px-3 py-2 text-sm text-mist">
                              <p className="font-medium text-fog">
                                {o.deliveryPartner.name || 'Delivery partner'}
                              </p>
                              {o.deliveryPartner.phone ? (
                                <p className="mt-1 font-mono text-xs">{o.deliveryPartner.phone}</p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {telHref(o.deliveryPartner.phone) ? (
                                  <a
                                    href={telHref(o.deliveryPartner.phone)}
                                    className="font-sans text-[11px] font-semibold text-accent hover:underline"
                                  >
                                    Call partner
                                  </a>
                                ) : null}
                                {whatsAppHref(o.deliveryPartner.phone) ? (
                                  <a
                                    href={whatsAppHref(o.deliveryPartner.phone)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-sans text-[11px] font-semibold text-accent hover:underline"
                                  >
                                    WhatsApp partner
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                          <p className="text-xs text-mist">
                            Stage: <span className="font-semibold text-fog">{deliveryStageLabel(o.deliveryStage)}</span>
                          </p>
                          <ol className="mt-2 space-y-1 text-xs text-mist">
                            {deliveryTimelineSteps(o).map((step) => (
                              <li key={step.key}>
                                <span className="text-fog">{step.label}</span>
                                {step.at ? (
                                  <span className="ml-2 font-mono text-[10px]">
                                    {new Date(step.at).toLocaleString()}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                          {detailRefreshingId === o.id ? (
                            <p className="mt-3 text-xs text-mist">Loading latest delivery details…</p>
                          ) : null}
                          <CustomerDeliveryOtpBlock
                            orderId={o.id}
                            deliveryStage={o.deliveryStage}
                            deliveryOtpVerified={o.deliveryOtpVerified}
                            active={expandedOrderId === o.id}
                          />
                          {o.deliveryStage === 'delivery_failed' ? (
                            <p className="mt-2 text-xs text-flare">
                              Delivery failed
                              {o.deliveryFailedReasonLabel ? `: ${o.deliveryFailedReasonLabel}` : ''}
                              {o.deliveryFailedReasonNote ? ` — ${o.deliveryFailedReasonNote}` : ''}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {Array.isArray(o.statusHistory) && o.statusHistory.length > 0 ? (
                        <div className="border-t border-steel/40 px-5 py-4">
                          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-hud">Order updates</p>
                          <ul className="space-y-2">
                            {o.statusHistory.map((h, idx) => (
                              <li key={`${o.id}-hist-${idx}`} className="rounded-lg border border-steel/50 bg-slate/30 px-3 py-2 text-xs text-mist">
                                <span className="font-semibold text-fog">{h.to}</span>
                                {h.from ? <span> (from {h.from})</span> : null}
                                {h.reason ? <span> · {h.reason}</span> : null}
                                <span className="ml-2 font-mono text-[10px] text-mist/80">{h.createdAt ? new Date(h.createdAt).toLocaleString() : ''}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {canRetryOnlinePayment(o) ? (
                        <div className="border-t border-steel/40 px-5 py-4">
                          <button
                            type="button"
                            onClick={() => void retryPayment(o)}
                            disabled={retryingOrderId === o.id}
                            className="rounded-xl border border-accent/45 bg-accent/15 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {retryingOrderId === o.id ? 'Opening Razorpay…' : 'Retry payment'}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </li>
              )
              })}
            </ul>
            {hasMore ? (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="rounded-xl border border-accent/40 bg-accent/15 px-5 py-2 font-mono text-xs uppercase tracking-wider text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
