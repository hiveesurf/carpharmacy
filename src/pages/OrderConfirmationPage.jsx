import { useEffect, useState } from 'react'

import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { AlertTriangle, CheckCircle2, Package, XCircle } from 'lucide-react'

import { formatInr } from '../data/partsCatalog'

import { useAuth } from '../context/useAuth'

import { useCart } from '../context/useCart'

import { apiV1Base } from '../api/client.js'

import * as orderService from '../services/orderService.js'

import { loadAddresses } from '../services/userService.js'

import { formatAddressBlock } from '../lib/formatAddress.js'

import { PAYMENT_OPTIONS, retryRazorpayPayment } from '../lib/checkoutFlow.js'

import { formatPaymentStatus } from '../lib/orderPaymentStatus.js'

import {
  CONFIRMATION_VIEW,
  resolveOrderConfirmationView,
} from '../lib/orderConfirmationView.js'
import { isOrderPaymentPaid } from '../lib/orderPaymentNormalize.js'

import { clearCheckoutSession } from '../lib/checkoutSession.js'

import { getFetchErrorMessage } from '../lib/apiErrorMessage.js'

import { Button } from '../components/ui/Button'



function paymentLabel(method) {

  return PAYMENT_OPTIONS.find((p) => p.id === method)?.label ?? method ?? '—'

}



function ConfirmationIcon({ icon }) {

  if (icon === 'success') {

    return (

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">

        <CheckCircle2 className="h-9 w-9" strokeWidth={1.5} aria-hidden />

      </div>

    )

  }

  if (icon === 'warning') {

    return (

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-flare-muted text-flare">

        <AlertTriangle className="h-9 w-9" strokeWidth={1.5} aria-hidden />

      </div>

    )

  }

  if (icon === 'error') {

    return (

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-flare-muted text-flare">

        <XCircle className="h-9 w-9" strokeWidth={1.5} aria-hidden />

      </div>

    )

  }

  return (

    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-steel/40 text-mist">

      <Package className="h-9 w-9" strokeWidth={1.5} aria-hidden />

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

  const paymentStatusLabel = formatPaymentStatus(order)

  const cardBorder =

    view.view === CONFIRMATION_VIEW.RAZORPAY_CANCELLED ||

    view.view === CONFIRMATION_VIEW.RAZORPAY_FAILED ||

    view.view === CONFIRMATION_VIEW.COD_INCONSISTENT

      ? 'border-flare/40'

      : 'border-steel/70'



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

        /* keep current order row */

      }

      setRetryError(getFetchErrorMessage(e))

    } finally {

      setRetryBusy(false)

    }

  }



  if (!authHydrated) {

    return (

      <div className="min-h-svh bg-slate pt-[calc(var(--nav-h)+2rem)] text-center text-mist">

        <p className="font-sans text-sm">Loading…</p>

      </div>

    )

  }



  if (!user || !apiOn) {

    return (

      <div className="min-h-svh bg-slate pt-[calc(var(--nav-h)+2rem)] text-center text-mist">

        <p className="font-sans text-sm">Sign in to view your order.</p>

      </div>

    )

  }



  return (

    <div className="relative min-h-svh overflow-hidden bg-slate pt-[calc(var(--nav-h)+1rem)] pb-20">

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/20 via-transparent to-slate" aria-hidden />

      <div className="relative z-[1] mx-auto max-w-lg px-4">

        {loading ? (

          <p className="text-center font-sans text-sm text-mist">Loading order…</p>

        ) : error ? (

          <div className="rounded-2xl border border-flare/40 bg-flare-muted p-6 text-center">

            <p className="text-sm text-fog">{error}</p>

            <Link to="/orders" className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">

              View my orders

            </Link>

          </div>

        ) : order ? (

          <div

            className={`rounded-2xl border ${cardBorder} bg-ink/95 p-8 text-center shadow-lg backdrop-blur-sm`}

          >

            <ConfirmationIcon icon={view.icon} />

            <h1 className="mt-6 font-display text-2xl font-black uppercase tracking-wide text-fog">

              {view.heading}

            </h1>

            <p className="mt-2 font-sans text-sm text-mist">{view.description}</p>

            {view.secondaryMessage ? (

              <p className="mt-2 font-sans text-sm text-mist">{view.secondaryMessage}</p>

            ) : null}

            {view.alert ? (

              <p className="mt-4 rounded-lg border border-flare/40 bg-flare-muted px-3 py-2 text-left text-xs text-fog">

                {view.alert}

              </p>

            ) : null}

            {retryError ? (

              <p className="mt-4 rounded-lg border border-flare/40 bg-flare-muted px-3 py-2 text-left text-xs text-fog">

                {retryError}

              </p>

            ) : null}



            <dl className="mt-8 space-y-4 text-left font-sans text-sm">

              <div className="rounded-xl border border-steel/60 bg-slate/40 px-4 py-3">

                <dt className="font-mono text-[10px] uppercase tracking-wider text-hud">Order ID</dt>

                <dd className="mt-1 font-mono text-sm text-fog">{order.id}</dd>

              </div>

              <div className="flex justify-between gap-4 rounded-xl border border-steel/60 bg-slate/40 px-4 py-3">

                <dt className="text-mist">Order status</dt>

                <dd className="font-semibold uppercase text-fog">{order.status || '—'}</dd>

              </div>

              <div className="flex justify-between gap-4 rounded-xl border border-steel/60 bg-slate/40 px-4 py-3">

                <dt className="text-mist">Payment status</dt>

                <dd className="font-semibold text-fog">{paymentStatusLabel}</dd>

              </div>

              <div className="flex justify-between gap-4 rounded-xl border border-steel/60 bg-slate/40 px-4 py-3">

                <dt className="text-mist">Payment method</dt>

                <dd className="text-right text-fog">{paymentLabel(order.paymentMethod)}</dd>

              </div>

              <div className="rounded-xl border border-steel/60 bg-slate/40 px-4 py-3">

                <dt className="font-mono text-[10px] uppercase tracking-wider text-hud">Delivery address</dt>

                <dd className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fog">

                  {address ? formatAddressBlock(address) : order.addressId ? `Address ID ${order.addressId}` : '—'}

                </dd>

              </div>

              <div className="flex justify-between gap-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3">

                <dt className="font-mono text-xs uppercase text-mist">Total</dt>

                <dd className="font-display text-xl font-bold text-accent">{formatInr(order.total)}</dd>

              </div>

            </dl>



            <div className="mt-8 flex flex-col gap-3 sm:flex-row">

              {view.showRetry ? (

                <Button

                  variant="primary"

                  size="md"

                  className="flex-1 w-full"

                  type="button"

                  disabled={retryBusy}

                  onClick={() => void handleRetryPayment()}

                >

                  {retryBusy ? 'Opening payment…' : 'Retry payment'}

                </Button>

              ) : null}

              <Link to="/orders" className="flex-1">

                <Button

                  variant={view.showRetry ? 'secondary' : 'primary'}

                  size="md"

                  className="w-full"

                  type="button"

                >

                  View my orders

                </Button>

              </Link>

              <Link to="/catalog" className="flex-1">

                <Button variant="secondary" size="md" className="w-full" type="button">

                  Continue shopping

                </Button>

              </Link>

            </div>

          </div>

        ) : null}

      </div>

    </div>

  )

}


