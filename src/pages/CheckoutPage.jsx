import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, CreditCard, MapPin, Package, Pencil, Plus } from 'lucide-react'
import { formatInr } from '../data/partsCatalog'
import { useCart } from '../context/useCart'
import { useAuth } from '../context/useAuth'
import { apiV1Base } from '../api/client.js'
import { Button } from '../components/ui/Button'
import { ToggleSwitch } from '../components/ui/ToggleSwitch'
import { ApiSectionError } from '../components/ui/ApiSectionError'
import { CartLineRow } from '../components/cart/CartLineRow'
import { createAddress, loadAddresses } from '../services/userService.js'
import { PAYMENT_OPTIONS, placeOrderWithPayment } from '../lib/checkoutFlow.js'
import { formatAddressBlock, formatAddressOneLine } from '../lib/formatAddress.js'
import {
  buildAddressPayload,
  findMatchingAddress,
  getAddressSaveErrorMessage,
  isAddressConflictError,
  validateAddressForm,
} from '../lib/addressHelpers.js'
import { getFetchErrorMessage } from '../lib/apiErrorMessage.js'
import { shouldRedirectCheckoutToCart } from '../lib/checkoutGuard.js'

const STEPS = [
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'review', label: 'Review', icon: Package },
]

const emptyAddr = () => ({
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  label: 'Home',
  gstNumber: '',
  isBusinessPurchase: false,
  isDefault: true,
})

function StepProgress({ step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === step)
  return (
    <nav aria-label="Checkout progress" className="mb-8">
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {STEPS.map((s, idx) => {
          const done = idx < currentIdx
          const active = s.id === step
          const Icon = s.icon
          return (
            <li
              key={s.id}
              className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors sm:px-4 ${
                active
                  ? 'border-accent/50 bg-accent/15 ring-1 ring-accent/35'
                  : done
                    ? 'border-steel/50 bg-slate/50'
                    : 'border-steel/40 bg-ink/40 opacity-70'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  active ? 'bg-accent text-on-accent' : done ? 'bg-accent/20 text-accent' : 'bg-steel/50 text-mist'
                }`}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-wider text-mist">Step {idx + 1}</p>
                <p className={`truncate font-sans text-sm font-semibold ${active ? 'text-fog' : 'text-mist'}`}>{s.label}</p>
              </div>
              {idx < STEPS.length - 1 ? (
                <ChevronRight className="ml-auto hidden h-4 w-4 shrink-0 text-mist sm:block" aria-hidden />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function CompletedSummary({ title, children, onChange }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-steel/60 bg-slate/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wider text-hud">{title}</p>
        <div className="mt-1 font-sans text-sm text-fog">{children}</div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-accent/40 px-3 py-1.5 font-sans text-xs font-semibold text-accent transition-colors hover:bg-accent/10 sm:self-center"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Change
      </button>
    </div>
  )
}

function ActiveStepCard({ icon: Icon, title, children, stepRef }) {
  return (
    <section
      ref={stepRef}
      tabIndex={-1}
      className="scroll-mt-[calc(var(--nav-h)+1rem)] rounded-2xl border-2 border-accent/40 bg-ink/95 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.45)] backdrop-blur-sm outline-none"
    >
      <div className="flex items-center gap-3 border-b border-accent/25 bg-accent/10 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-on-accent">
          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-fog">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

/** @param {{ address: object, selected: boolean, onSelect: () => void }} props */
function AddressSelectCard({ address, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3.5 text-left transition-all sm:p-4 ${
        selected
          ? 'border-accent bg-accent/10 ring-2 ring-accent/40 shadow-[0_0_0_1px] shadow-accent/20'
          : 'border-steel/60 bg-slate/40 hover:border-accent/35 hover:bg-slate/55'
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? 'border-accent bg-accent text-on-accent' : 'border-steel/80 bg-ink/60'
          }`}
          aria-hidden
        >
          {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-hud">
              {address.label || 'Address'}
            </p>
            {address.isDefault ? (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                Default
              </span>
            ) : null}
            {selected ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-on-accent">
                Selected
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 line-clamp-2 font-sans text-sm leading-snug text-fog">
            {[address.line1, address.line2].filter(Boolean).join(', ')}
          </p>
          <p className="mt-0.5 font-sans text-xs text-mist">
            {[address.city, address.state, address.pincode].filter(Boolean).join(', ')}
            {address.country ? ` · ${address.country}` : ''}
          </p>
          {address.gstNumber ? (
            <p className="mt-0.5 font-sans text-xs text-mist">GST: {address.gstNumber}</p>
          ) : null}
        </div>
      </div>
    </button>
  )
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const apiOn = Boolean(apiV1Base())
  const { user, authHydrated, openAuth } = useAuth()
  const { lineItems, itemCount, subtotal, cartLoading, cartError, retryCart, clearCart, refreshCart } = useCart()

  const [step, setStep] = useState('address')
  const [stepError, setStepError] = useState(null)

  const [addresses, setAddresses] = useState([])
  const [addrLoading, setAddrLoading] = useState(true)
  const [addrError, setAddrError] = useState(null)
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [showAddrForm, setShowAddrForm] = useState(false)
  const [addrForm, setAddrForm] = useState(emptyAddr)
  const [addrSaving, setAddrSaving] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [placeBusy, setPlaceBusy] = useState(false)
  /** True from Place Order click until success navigation or hard failure (no order). */
  const [checkoutActive, setCheckoutActive] = useState(false)
  /** Order returned by the server; source of truth after cart is cleared. */
  const [createdOrder, setCreatedOrder] = useState(null)
  /** Snapshot of review lines so UI does not depend on cart after order creation. */
  const [reviewLines, setReviewLines] = useState(null)

  const checkoutStarted = checkoutActive || placeBusy || Boolean(createdOrder?.id)
  const activeStepRef = useRef(null)
  const prevStepRef = useRef(step)

  const displayLines = reviewLines ?? lineItems
  const displaySubtotal = useMemo(
    () => displayLines.reduce((sum, line) => sum + Number(line.lineTotal ?? 0), 0),
    [displayLines],
  )

  const loadAddr = useCallback(async () => {
    if (!apiOn || !user) return []
    setAddrLoading(true)
    setAddrError(null)
    try {
      const items = await loadAddresses()
      const list = Array.isArray(items) ? items : []
      setAddresses(list)
      const def = list.find((a) => a.isDefault) || list[0]
      setSelectedAddressId((prev) => {
        if (prev && list.some((a) => String(a.id) === String(prev))) return prev
        return def?.id ? String(def.id) : ''
      })
      return list
    } catch (e) {
      setAddrError(getFetchErrorMessage(e))
      setAddresses([])
      return []
    } finally {
      setAddrLoading(false)
    }
  }, [apiOn, user])

  function selectExistingAddress(addr) {
    if (!addr?.id) return
    setSelectedAddressId(String(addr.id))
    setStepError(null)
    setShowAddrForm(false)
    setAddrForm(emptyAddr())
  }

  useEffect(() => {
    if (!authHydrated || !apiOn || !user) return
    void refreshCart()
  }, [authHydrated, apiOn, user, refreshCart])

  useEffect(() => {
    if (!authHydrated) return
    if (!user) {
      openAuth()
      return
    }
    if (!apiOn) return
    void loadAddr()
  }, [authHydrated, user, apiOn, openAuth, loadAddr])

  useEffect(() => {
    if (
      !shouldRedirectCheckoutToCart({
        authHydrated,
        apiOn,
        cartLoading,
        itemCount,
        cartError,
        checkoutStarted,
      })
    ) {
      return
    }
    navigate('/cart', { replace: true })
  }, [authHydrated, apiOn, cartLoading, itemCount, cartError, checkoutStarted, navigate])

  const selectedAddress = useMemo(
    () => addresses.find((a) => String(a.id) === String(selectedAddressId)) ?? null,
    [addresses, selectedAddressId],
  )

  const selectedPayment = PAYMENT_OPTIONS.find((p) => p.id === paymentMethod) ?? PAYMENT_OPTIONS[0]

  function continueToPayment() {
    setStepError(null)
    if (!selectedAddressId) {
      setStepError('Please select a delivery address or save a new one.')
      return
    }
    setStep('payment')
  }

  function continueToReview() {
    setStepError(null)
    if (!paymentMethod || !PAYMENT_OPTIONS.some((p) => p.id === paymentMethod)) {
      setStepError('Please select a payment method.')
      return
    }
    setReviewLines(lineItems)
    setStep('review')
  }

  // After address → payment (or any step change), document height shrinks while scrollY stays
  // high — the viewport lands near the footer. Bring the active step card into view instead.
  useEffect(() => {
    if (prevStepRef.current === step) return
    prevStepRef.current = step
    const el = activeStepRef.current
    if (!el) return
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      try {
        el.focus({ preventScroll: true })
      } catch {
        /* ignore */
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [step])

  async function saveNewAddress(e) {
    e.preventDefault()
    const validationMsg = validateAddressForm(addrForm)
    if (validationMsg) {
      setStepError(validationMsg)
      return
    }

    const draft = buildAddressPayload(addrForm)

    const existing = findMatchingAddress(addresses, draft)
    if (existing) {
      selectExistingAddress(existing)
      setStepError(
        'This address is already in your saved list — we selected it for you. Tap Continue to payment when ready.',
      )
      return
    }

    setAddrSaving(true)
    setStepError(null)
    try {
      const created = await createAddress(draft)
      setAddresses((prev) => [created, ...prev.filter((a) => String(a.id) !== String(created.id))])
      selectExistingAddress(created)
    } catch (err) {
      if (isAddressConflictError(err)) {
        const fresh = await loadAddr()
        const match = findMatchingAddress(fresh, draft)
        if (match) {
          selectExistingAddress(match)
          setStepError(
            'This address is already saved — we selected it below. Tap Continue to payment when ready, or change the label to add another entry.',
          )
          return
        }
      }
      setStepError(getAddressSaveErrorMessage(err))
    } finally {
      setAddrSaving(false)
    }
  }

  async function handlePlaceOrder() {
    setStepError(null)
    if (!selectedAddressId) {
      setStep('address')
      setStepError('Please select a delivery address.')
      return
    }
    if (!paymentMethod) {
      setStep('payment')
      setStepError('Please select a payment method.')
      return
    }
    const linesForOrder = reviewLines ?? lineItems
    if (linesForOrder.length <= 0) {
      setStepError('Your cart is empty.')
      return
    }
    setReviewLines(linesForOrder)
    setCheckoutActive(true)
    setPlaceBusy(true)
    try {
      const { order } = await placeOrderWithPayment({
        addressId: selectedAddressId,
        paymentMethod,
        user,
        clearCart,
      })
      setCreatedOrder(order)
      navigate(`/orders/confirmation/${encodeURIComponent(order.id)}`, {
        replace: true,
        state: { order, address: selectedAddress },
      })
    } catch (e) {
      const placed = e?.placedOrder
      if (placed?.id) {
        setCreatedOrder(placed)
        await clearCart()
        navigate(`/orders/confirmation/${encodeURIComponent(placed.id)}`, {
          replace: true,
          state: {
            order: placed,
            address: selectedAddress,
          },
        })
        return
      }
      setCheckoutActive(false)
      setReviewLines(null)
      setStepError(getFetchErrorMessage(e))
    } finally {
      setPlaceBusy(false)
    }
  }

  if (!authHydrated) {
    return (
      <div className="min-h-svh bg-slate pt-[calc(var(--nav-h)+2rem)] text-center text-mist">
        <p className="font-sans text-sm">Loading…</p>
      </div>
    )
  }

  if (!apiOn) {
    return (
      <div className="min-h-svh bg-slate pt-[calc(var(--nav-h)+2rem)] px-4 text-center text-mist">
        <p className="font-sans text-sm">Checkout requires the API.</p>
        <Link to="/cart" className="mt-4 inline-block text-accent hover:underline">
          Back to cart
        </Link>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-svh bg-slate pt-[calc(var(--nav-h)+2rem)] text-center text-mist">
        <p className="font-sans text-sm">Sign in to continue checkout.</p>
      </div>
    )
  }

  const addressDone = step === 'payment' || step === 'review'
  const paymentDone = step === 'review'

  return (
    <div className="relative min-h-svh overflow-hidden bg-slate pt-[calc(var(--nav-h)+1rem)] pb-20">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/20 via-transparent to-slate" aria-hidden />
      <div className="relative z-[1] mx-auto max-w-3xl px-4">
        <Link
          to="/cart"
          className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-hud transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          Back to cart
        </Link>

        <header className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-hud">Secure checkout</p>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-wide text-fog">Checkout</h1>
        </header>

        <StepProgress step={step} />

        {cartError ? (
          <div className="mb-6">
            <ApiSectionError title="Cart could not load" message={cartError} onRetry={retryCart} />
          </div>
        ) : null}

        <div className="space-y-4">
          {addressDone && selectedAddress ? (
            <CompletedSummary title="Delivery address" onChange={() => setStep('address')}>
              <p className="font-semibold">{selectedAddress.label || 'Address'}</p>
              <p className="mt-0.5 whitespace-pre-line text-sm text-mist">{formatAddressBlock(selectedAddress)}</p>
            </CompletedSummary>
          ) : null}

          {paymentDone ? (
            <CompletedSummary title="Payment method" onChange={() => setStep('payment')}>
              <p>{selectedPayment.label}</p>
            </CompletedSummary>
          ) : null}

          {step === 'address' ? (
            <ActiveStepCard icon={MapPin} title="Delivery address" stepRef={activeStepRef}>
              {addrLoading ? (
                <p className="font-sans text-sm text-mist">Loading addresses…</p>
              ) : addrError ? (
                <ApiSectionError title="Addresses unavailable" message={addrError} onRetry={loadAddr} />
              ) : (
                <>
                  {addresses.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {addresses.map((a) => (
                        <AddressSelectCard
                          key={a.id}
                          address={a}
                          selected={String(a.id) === String(selectedAddressId)}
                          onSelect={() => selectExistingAddress(a)}
                        />
                      ))}
                    </div>
                  ) : !showAddrForm ? (
                    <p className="rounded-xl border border-dashed border-steel/60 bg-slate/30 px-4 py-6 text-center font-sans text-sm text-mist">
                      No saved addresses yet. Add one to continue checkout.
                    </p>
                  ) : null}

                  {!showAddrForm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddrForm(true)
                        setStepError(null)
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 px-3 py-2 font-sans text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Add new address
                    </button>
                  ) : (
                    <form
                      onSubmit={saveNewAddress}
                      className="mt-4 space-y-3 rounded-xl border border-accent/30 bg-slate/30 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-display text-sm font-bold uppercase text-fog">New address</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddrForm(false)
                            setAddrForm(emptyAddr())
                            setStepError(null)
                          }}
                          className="font-sans text-xs text-mist hover:text-fog"
                        >
                          Cancel
                        </button>
                      </div>
                      {['line1', 'line2', 'city', 'state', 'pincode', 'country', 'label'].map((field) => (
                        <div key={field}>
                          <label className="block font-mono text-[9px] uppercase text-mist">{field}</label>
                          <input
                            required={field === 'line1' || field === 'city' || field === 'pincode'}
                            value={addrForm[field] ?? ''}
                            onChange={(e) => setAddrForm((f) => ({ ...f, [field]: e.target.value }))}
                            className="mt-0.5 w-full rounded-lg border border-steel/70 bg-ink px-2 py-2 text-sm text-fog outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                          />
                        </div>
                      ))}
                      <label
                        htmlFor="checkout-business-purchase"
                        className="flex cursor-pointer items-center gap-3 font-sans text-sm text-fog"
                      >
                        <ToggleSwitch
                          id="checkout-business-purchase"
                          checked={Boolean(addrForm.isBusinessPurchase)}
                          onChange={(e) =>
                            setAddrForm((f) => ({
                              ...f,
                              isBusinessPurchase: e.target.checked,
                              gstNumber: e.target.checked ? (f.gstNumber ?? '') : '',
                            }))
                          }
                        />
                        I'm purchasing as a business
                      </label>
                      {addrForm.isBusinessPurchase ? (
                        <div>
                          <label htmlFor="checkout-gst-number" className="block font-mono text-[9px] uppercase text-mist">
                            GST Number
                          </label>
                          <input
                            id="checkout-gst-number"
                            type="text"
                            autoComplete="off"
                            maxLength={15}
                            value={addrForm.gstNumber ?? ''}
                            onChange={(e) => setAddrForm((f) => ({ ...f, gstNumber: e.target.value }))}
                            className="mt-0.5 w-full rounded-lg border border-steel/70 bg-ink px-2 py-2 text-sm uppercase text-fog outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                          />
                        </div>
                      ) : null}
                      <label className="flex items-center gap-2 font-sans text-sm text-fog">
                        <input
                          type="checkbox"
                          className="accent-accent"
                          checked={Boolean(addrForm.isDefault)}
                          onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))}
                        />
                        Set as default address
                      </label>
                      <Button type="submit" variant="primary" disabled={addrSaving}>
                        {addrSaving ? 'Saving…' : 'Save address'}
                      </Button>
                    </form>
                  )}

                  <div className="mt-6 flex flex-col-reverse gap-3 border-t border-steel/50 pt-5 sm:flex-row sm:items-center sm:justify-end">
                    {stepError && step === 'address' ? (
                      <p
                        className="sm:mr-auto sm:flex-1 rounded-lg border border-flare/40 bg-flare-muted px-3 py-2 text-sm text-fog"
                        role="alert"
                      >
                        {stepError}
                      </p>
                    ) : (
                      <span className="hidden sm:block sm:flex-1" />
                    )}
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full sm:w-auto"
                      type="button"
                      onClick={continueToPayment}
                      disabled={!selectedAddressId}
                    >
                      Continue to payment
                    </Button>
                  </div>
                </>
              )}
            </ActiveStepCard>
          ) : null}

          {step === 'payment' ? (
            <ActiveStepCard icon={CreditCard} title="Payment method" stepRef={activeStepRef}>
              <ul className="space-y-3">
                {PAYMENT_OPTIONS.map((opt) => {
                  const selected = paymentMethod === opt.id
                  return (
                    <li key={opt.id}>
                      <label
                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                          selected
                            ? 'border-accent/50 bg-accent/10 ring-1 ring-accent/30'
                            : 'border-steel/60 bg-slate/40 hover:border-accent/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="checkout-payment"
                          className="mt-1 accent-accent"
                          checked={selected}
                          onChange={() => {
                            setPaymentMethod(opt.id)
                            setStepError(null)
                          }}
                        />
                        <div>
                          <p className="font-sans text-sm font-semibold text-fog">{opt.label}</p>
                          <p className="mt-1 font-sans text-xs text-mist">{opt.description}</p>
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="secondary" size="md" type="button" className="sm:order-1" onClick={() => setStep('address')}>
                  Back to address
                </Button>
                <Button variant="primary" size="lg" type="button" className="flex-1 sm:order-2" onClick={continueToReview}>
                  Continue to review
                </Button>
              </div>
            </ActiveStepCard>
          ) : null}

          {step === 'review' ? (
            <ActiveStepCard icon={Package} title="Review order" stepRef={activeStepRef}>
              <ul className="space-y-4">
                {displayLines.map(({ part, qty, lineTotal }) => (
                  <CartLineRow key={part.id} part={part} qty={qty} lineTotal={lineTotal} compact readOnly />
                ))}
              </ul>
              {!checkoutStarted ? (
                <p className="mt-3 font-sans text-xs text-mist">
                  <Link to="/cart" className="font-semibold text-accent hover:underline">
                    Edit cart
                  </Link>
                </p>
              ) : null}

              <dl className="mt-6 space-y-3 rounded-xl border border-steel/50 bg-slate/30 px-4 py-4 font-sans text-sm">
                <div>
                  <dt className="font-mono text-[10px] uppercase text-hud">Deliver to</dt>
                  <dd className="mt-1 text-fog">
                    {selectedAddress ? formatAddressOneLine(selectedAddress) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-hud">Payment</dt>
                  <dd className="mt-1 text-fog">{selectedPayment.label}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-steel/40 pt-3">
                  <dt className="font-mono text-xs uppercase text-mist">Order total</dt>
                  <dd className="font-display text-xl font-bold text-accent">{formatInr(displaySubtotal)}</dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="secondary" size="md" type="button" onClick={() => setStep('payment')}>
                  Back to payment
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  type="button"
                  disabled={placeBusy || cartLoading || (displayLines.length <= 0 && !checkoutStarted)}
                  onClick={() => void handlePlaceOrder()}
                >
                  {placeBusy
                    ? paymentMethod === 'cod'
                      ? 'Placing order…'
                      : 'Processing…'
                    : paymentMethod === 'cod'
                      ? 'Place order'
                      : 'Place order & pay'}
                </Button>
              </div>
            </ActiveStepCard>
          ) : null}

          {stepError && step !== 'address' ? (
            <p className="rounded-xl border border-flare/40 bg-flare-muted px-4 py-3 text-sm text-fog" role="alert">
              {stepError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
