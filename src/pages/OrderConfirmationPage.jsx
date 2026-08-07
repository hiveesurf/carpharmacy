import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Banknote, Check, Package, XCircle } from 'lucide-react'
import { formatInr, getPartById } from '../data/partsCatalog'
import { useAuth } from '../context/useAuth'
import { useCart } from '../context/useCart'
import { apiV1Base } from '../api/client.js'
import * as orderService from '../services/orderService.js'
import { loadAddresses } from '../services/userService.js'
import { retryRazorpayPayment } from '../lib/checkoutFlow.js'
import {
  CONFIRMATION_VIEW,
  resolveOrderConfirmationView,
} from '../lib/orderConfirmationView.js'
import {
  isCashOnDeliveryOrder,
  isOrderPaymentPaid,
} from '../lib/orderPaymentNormalize.js'
import { clearCheckoutSession } from '../lib/checkoutSession.js'
import { getFetchErrorMessage } from '../lib/apiErrorMessage.js'
import { partDisplayImage } from '../lib/productImage.js'
import { publicUrl } from '../lib/publicUrl'
import { SafeImg } from '../components/ui/SafeImg.jsx'
import {
  downloadReceipt,
  formatReceiptDate,
  paymentDetailLine,
  paymentMethodLabel,
  shortOrderId,
} from '../lib/downloadOrderReceipt.js'

const cardClass =
  'mx-auto w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white text-[#111827] shadow-none'

const mutedLabel = 'text-[11px] font-medium uppercase tracking-wide text-[#9ca3af]'

function SiteLogo({ size = 'md', className = '' }) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  return (
    <img
      src={publicUrl('logo-carnalysys.png')}
      alt="CarPharmacy"
      className={`${box} rounded-full border border-[#e5e7eb] object-cover ${className}`}
      loading="eager"
      decoding="async"
    />
  )
}

function SuccessCheck() {
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#16a34a]">
      <Check className="h-7 w-7 text-white" strokeWidth={2.5} aria-hidden />
    </div>
  )
}

function StatusIcon({ icon }) {
  if (icon === 'success') return <SuccessCheck />
  if (icon === 'warning') {
    return (
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fef3c7]">
        <AlertTriangle className="h-7 w-7 text-[#d97706]" strokeWidth={2} aria-hidden />
      </div>
    )
  }
  if (icon === 'error') {
    return (
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fee2e2]">
        <XCircle className="h-7 w-7 text-[#dc2626]" strokeWidth={2} aria-hidden />
      </div>
    )
  }
  return (
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f3f4f6]">
      <Package className="h-7 w-7 text-[#6b7280]" strokeWidth={1.75} aria-hidden />
    </div>
  )
}

function lineThumbnail(line) {
  const part = getPartById(line?.productId)
  if (!part) return null
  try {
    return partDisplayImage(part)
  } catch {
    return null
  }
}

function ItemRow({ line }) {
  const img = lineThumbnail(line)
  const name = line?.productName || 'Product'
  const sku = line?.sku ? String(line.sku) : null
  const qty = Number(line?.quantity ?? 0)
  const unit = Number(line?.unitPrice ?? 0)
  const lineTotal = Number(line?.lineTotal ?? unit * qty)

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
        {img?.src ? (
          <SafeImg
            src={img.src}
            alt={img.alt || name}
            fw={88}
            fh={88}
            className="h-full w-full object-cover"
            width={44}
            height={44}
            loading="lazy"
          />
        ) : (
          <Package className="h-5 w-5 text-[#9ca3af]" strokeWidth={1.75} aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-[#111827]">{name}</p>
        <p className="mt-0.5 text-xs text-[#6b7280]">
          {sku ? `${sku} · ` : ''}
          {qty} x {formatInr(unit)}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-[#111827]">{formatInr(lineTotal)}</p>
    </div>
  )
}

export function OrderConfirmationPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, authHydrated, openAuth } = useAuth()
  const { clearCart } = useCart()
  const apiOn = Boolean(apiV1Base())

  const stateOrder = location.state?.order
  const stateAddress = location.state?.address
  const [order, setOrder] = useState(stateOrder ?? null)
  const [address, setAddress] = useState(stateAddress ?? null)
  const [loading, setLoading] = useState(Boolean(apiOn && id && !stateOrder))
  const [error, setError] = useState(null)
  const [retryBusy, setRetryBusy] = useState(false)
  const [retryError, setRetryError] = useState(null)
  const [downloadError, setDownloadError] = useState(null)

  useEffect(() => {
    if (!authHydrated) return
    if (!user) {
      openAuth()
      return
    }
    if (!apiOn || !id) return
    if (stateAddress) setAddress(stateAddress)
    let cancel = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const fresh = await orderService.getOrder(id)
        if (!cancel) setOrder(fresh)
        if (!cancel && !stateAddress && fresh?.addressId) {
          try {
            const addrs = await loadAddresses()
            const match = (Array.isArray(addrs) ? addrs : []).find(
              (a) => String(a.id) === String(fresh.addressId),
            )
            if (match) setAddress(match)
          } catch {
            /* optional */
          }
        }
      } catch (e) {
        if (!cancel) {
          if (stateOrder) setOrder(stateOrder)
          else setError(getFetchErrorMessage(e))
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [authHydrated, user, apiOn, id, stateOrder, stateAddress, openAuth])

  useEffect(() => {
    if (!order) return
    const paid = isOrderPaymentPaid(order)
    const status = String(order.status || '').toLowerCase()
    const placed = status === 'placed' || status === 'confirmed'
    if (!paid && !placed) return
    clearCheckoutSession()
    void clearCart()
  }, [order, clearCart])

  const view = resolveOrderConfirmationView(order)
  const lines = useMemo(() => (Array.isArray(order?.lines) ? order.lines : []), [order])
  const subtotal = order?.subtotal != null ? Number(order.subtotal) : null
  const total = order?.total != null ? Number(order.total) : null
  const isCod = order ? isCashOnDeliveryOrder(order) : false
  const isSuccessView =
    view.view === CONFIRMATION_VIEW.RAZORPAY_PAID ||
    view.view === CONFIRMATION_VIEW.COD_CONFIRMED ||
    view.view === CONFIRMATION_VIEW.COD_COLLECTED

  async function handleRetryPayment() {
    if (!order?.id || retryBusy) return
    setRetryError(null)
    setRetryBusy(true)
    try {
      const fresh = await retryRazorpayPayment({ order, user })
      setOrder(fresh)
      navigate(`/orders/confirmation/${encodeURIComponent(order.id)}`, {
        replace: true,
        state: { order: fresh, address },
      })
    } catch (e) {
      try {
        const fresh = await orderService.getOrder(order.id)
        setOrder(fresh)
      } catch {
        /* keep current */
      }
      setRetryError(getFetchErrorMessage(e))
    } finally {
      setRetryBusy(false)
    }
  }

  function handleDownload() {
    if (!order) return
    setDownloadError(null)
    try {
      downloadReceipt(order)
    } catch (e) {
      setDownloadError(e?.message || 'Could not download receipt')
    }
  }

  if (!authHydrated) {
    return (
      <div className="min-h-svh bg-[#f3f4f6] pt-[calc(var(--nav-h)+2rem)] text-center text-[#6b7280]">
        <p className="text-sm">Loading…</p>
      </div>
    )
  }

  if (!user || !apiOn) {
    return (
      <div className="min-h-svh bg-[#f3f4f6] pt-[calc(var(--nav-h)+2rem)] text-center text-[#6b7280]">
        <p className="text-sm">Sign in to view your order.</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[#f3f4f6] pt-[calc(var(--nav-h)+1rem)] pb-16">
      <div className="mx-auto max-w-[440px] px-6">
        {loading ? (
          <p className="text-center text-sm text-[#6b7280]">Loading order…</p>
        ) : error ? (
          <div className={`${cardClass} p-6 text-center`}>
            <p className="text-sm text-[#111827]">{error}</p>
            <Link to="/orders" className="mt-4 inline-block text-sm font-semibold text-[#2563eb] hover:underline">
              View my orders
            </Link>
          </div>
        ) : order ? (
          <>
            <article className={cardClass}>
              {/* 1. Header */}
              <header className="flex items-center gap-2.5 border-b border-[#e5e7eb] px-6 py-4">
                <SiteLogo />
                <span className="text-base font-semibold tracking-tight text-[#111827]">CarPharmacy</span>
              </header>

              {/* 2. Confirmation */}
              <div className="px-6 py-7 text-center">
                <StatusIcon icon={view.icon} />
                <h1 className="mt-4 text-xl font-semibold text-[#111827]">
                  {isSuccessView ? 'Order confirmed' : view.heading}
                </h1>
                <p className="mt-1.5 text-sm text-[#6b7280]">
                  {isSuccessView ? 'Your order has been placed successfully' : view.description}
                </p>
                {view.secondaryMessage ? (
                  <p className="mt-2 text-sm text-[#6b7280]">{view.secondaryMessage}</p>
                ) : null}
                {view.alert ? (
                  <p className="mt-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-left text-xs text-[#991b1b]">
                    {view.alert}
                  </p>
                ) : null}
                {retryError ? (
                  <p className="mt-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-left text-xs text-[#991b1b]">
                    {retryError}
                  </p>
                ) : null}
              </div>

              {/* 3. Order id / Date strip */}
              <div className="grid grid-cols-2 border-y border-[#e5e7eb]">
                <div className="border-r border-[#e5e7eb] px-6 py-4 text-left">
                  <p className={mutedLabel}>Order id</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[#111827]">
                    {shortOrderId(order.id)}
                  </p>
                </div>
                <div className="px-6 py-4 text-left">
                  <p className={mutedLabel}>Date</p>
                  <p className="mt-1 text-sm font-semibold text-[#111827]">
                    {formatReceiptDate(order.createdAt || order.placedAt)}
                  </p>
                </div>
              </div>

              {/* 4. Items */}
              <section className="px-6 py-5">
                <p className={mutedLabel}>Item{lines.length === 1 ? '' : 's'}</p>
                <div className="mt-3 space-y-4">
                  {lines.length === 0 ? (
                    <p className="text-sm text-[#6b7280]">No items on this order.</p>
                  ) : (
                    lines.map((line, idx) => (
                      <ItemRow key={`${line.productId || 'line'}-${idx}`} line={line} />
                    ))
                  )}
                </div>
              </section>

              {/* 5. Payment */}
              <section className="px-6 pb-5">
                <p className={mutedLabel}>Payment</p>
                <div className="mt-3 rounded-xl bg-[#f3f4f6] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#111827]">
                      <Banknote className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <p className="text-sm font-medium text-[#111827]">{paymentMethodLabel(order)}</p>
                  </div>
                  <div className="my-3 border-t border-[#e5e7eb]" />
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#6b7280]">Payment status</span>
                    <span className="text-right font-medium text-[#111827]">{paymentDetailLine(order)}</span>
                  </div>
                  {!isCod &&
                  (order.paymentTxnId ||
                    order.latestPaymentAttempt?.providerPaymentId ||
                    order.latestPaymentAttempt?.providerOrderId) ? (
                    <>
                      <div className="my-3 border-t border-[#e5e7eb]" />
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <span className="shrink-0 text-[#6b7280]">Transaction</span>
                        <span className="break-all text-right font-mono text-xs text-[#111827]">
                          {order.paymentTxnId ||
                            order.latestPaymentAttempt?.providerPaymentId ||
                            order.latestPaymentAttempt?.providerOrderId}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              </section>

              {/* 6. Price breakdown */}
              <section className="border-t border-[#e5e7eb] px-6 py-5">
                <p className={mutedLabel}>Price breakdown</p>
                <div className="mt-3 space-y-2 text-sm">
                  {subtotal != null && !Number.isNaN(subtotal) ? (
                    <div className="flex justify-between gap-3">
                      <span className="text-[#6b7280]">Subtotal</span>
                      <span className="tabular-nums text-[#111827]">{formatInr(subtotal)}</span>
                    </div>
                  ) : null}
                  <div className="border-t border-[#e5e7eb] pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#111827]">Grand total</span>
                      <span className="text-lg font-bold tabular-nums text-[#111827]">
                        {total != null && !Number.isNaN(total) ? formatInr(total) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 7. Footer */}
              <footer className="border-t border-[#e5e7eb] px-6 py-5 text-center">
                <SiteLogo size="sm" className="mx-auto" />
                <p className="mt-3 text-sm text-[#6b7280]">Thanks for shopping with CarPharmacy</p>
              </footer>
            </article>

            {/* 8. Actions below card */}
            <div className="mt-5 space-y-3">
              {downloadError ? (
                <p className="text-center text-xs text-[#dc2626]">{downloadError}</p>
              ) : null}
              <button
                type="button"
                onClick={handleDownload}
                className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-on-accent transition-[filter] hover:brightness-95"
              >
                Download
              </button>
              {view.showRetry ? (
                <button
                  type="button"
                  disabled={retryBusy}
                  onClick={() => void handleRetryPayment()}
                  className="flex w-full items-center justify-center rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition-colors hover:bg-[#f9fafb] disabled:opacity-50"
                >
                  {retryBusy ? 'Opening payment…' : 'Retry payment'}
                </button>
              ) : null}
              <div className="flex gap-3">
                <Link
                  to="/orders"
                  className="flex flex-1 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
                >
                  My orders
                </Link>
                <Link
                  to="/catalog"
                  className="flex flex-1 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
                >
                  Continue shopping
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
