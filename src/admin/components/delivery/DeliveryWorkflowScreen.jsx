import { useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import { useDeliveryWorkflow } from '../../hooks/useDeliveryWorkflow.js'
import { DELIVERY_FAILED_REASONS, normalizeDeliveryStage } from '../../../lib/deliveryStage.js'
import { formatDeliveryAddress } from '../../../lib/deliveryUiStage.js'
import { DeliveryStageBadge } from './DeliveryStageBadge.jsx'
import { DeliveryWorkflowTimeline } from './DeliveryWorkflowTimeline.jsx'
import { AuthenticatedApiImage } from '../AuthenticatedApiImage.jsx'
import { DELIVERY_LIST_PATH, deliveryDetailPath } from '../../../lib/deliveryRoutes.js'
import {
  DELIVERY_CANVAS,
  DELIVERY_CARD,
  DELIVERY_CARD_PAD,
  DELIVERY_GHOST_BTN,
  DELIVERY_INPUT_FOCUS,
  DELIVERY_LABEL,
  DELIVERY_LINK,
  DELIVERY_PRIMARY_BTN,
  DELIVERY_SECONDARY_BTN,
  DELIVERY_SHELL,
} from './deliveryTheme.js'

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function ContactActions({ tel, wa, maps }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {tel ? (
        <a href={tel} className={DELIVERY_SECONDARY_BTN}>
          <Phone className="h-5 w-5 text-flare" aria-hidden />
          Call
        </a>
      ) : (
        <span className={`${DELIVERY_SECONDARY_BTN} pointer-events-none opacity-40`}>
          <Phone className="h-5 w-5" aria-hidden />
          Call
        </span>
      )}
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className={DELIVERY_SECONDARY_BTN}>
          <MessageCircle className="h-5 w-5 text-flare" aria-hidden />
          WhatsApp
        </a>
      ) : (
        <span className={`${DELIVERY_SECONDARY_BTN} pointer-events-none opacity-40`}>
          <MessageCircle className="h-5 w-5" aria-hidden />
          WhatsApp
        </span>
      )}
      {maps ? (
        <a href={maps} target="_blank" rel="noopener noreferrer" className={DELIVERY_SECONDARY_BTN}>
          <Navigation className="h-5 w-5 text-flare" aria-hidden />
          Navigate
        </a>
      ) : (
        <span className={`${DELIVERY_SECONDARY_BTN} pointer-events-none opacity-40`}>
          <Navigation className="h-5 w-5" aria-hidden />
          Navigate
        </span>
      )}
    </div>
  )
}

function DeliveredSuccess({ order, nextOrderId, listPath }) {
  return (
    <div className={DELIVERY_CANVAS}>
      <div className={`${DELIVERY_SHELL} justify-center py-4`}>
        <div className={`${DELIVERY_CARD} ${DELIVERY_CARD_PAD} text-center`}>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-12 w-12" strokeWidth={2} aria-hidden />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-[#0f1111]">Delivered successfully</h2>
          <p className="mt-2 text-sm text-[#565959]">Great job — this order is complete.</p>

          <dl className="mt-8 space-y-3 rounded-lg border border-[#e7e7e7] bg-[#fafafa] p-4 text-left text-sm">
            <div>
              <dt className={DELIVERY_LABEL}>Customer</dt>
              <dd className="mt-1 font-semibold text-[#0f1111]">
                {order?.customerName?.trim() || 'Customer'}
              </dd>
            </div>
            <div>
              <dt className={DELIVERY_LABEL}>Delivery time</dt>
              <dd className="mt-1 font-medium text-[#0f1111]">
                {formatDateTime(order?.deliveryDeliveredAt)}
              </dd>
            </div>
            <div>
              <dt className={DELIVERY_LABEL}>Order ID</dt>
              <dd className="mt-1 font-mono text-xs text-[#565959]">{order?.id}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3">
            {nextOrderId ? (
              <Link
                to={
                  listPath === DELIVERY_LIST_PATH || listPath.startsWith('/delivery/')
                    ? deliveryDetailPath(nextOrderId)
                    : `/admin/orders/${encodeURIComponent(nextOrderId)}`
                }
                className={DELIVERY_PRIMARY_BTN}
              >
                Next order
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Link>
            ) : null}
            <Link
              to={listPath}
              className={
                nextOrderId
                  ? 'flex min-h-[48px] items-center justify-center rounded-lg border border-[#d5d9d9] bg-white text-sm font-semibold text-[#0f1111] shadow-sm hover:bg-[#f7fafa]'
                  : DELIVERY_PRIMARY_BTN
              }
            >
              Back to deliveries
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   order: object,
 *   busyId: string | null,
 *   onBusy: (id: string | null) => void,
 *   onUpdated: (order: object) => void,
 *   error: string | null,
 *   onError: (msg: string | null) => void,
 *   nextOrderId?: string | null,
 *   listPath?: string,
 * }} props
 */
export function DeliveryWorkflowScreen({
  order,
  busyId,
  onBusy,
  onUpdated,
  error,
  onError,
  nextOrderId = null,
  listPath = DELIVERY_LIST_PATH,
}) {
  const proofInputRef = useRef(null)
  const {
    uiStage,
    otpInput,
    setOtpInput,
    confirmReached,
    failReason,
    setFailReason,
    failNote,
    setFailNote,
    showFailForm,
    setShowFailForm,
    tel,
    wa,
    maps,
    busy,
    run,
    uploadProof,
    reached,
    resendSuccess,
  } = useDeliveryWorkflow({ order, onUpdated, onError, onBusy, busyId })

  const customerName = order?.customerName?.trim() || 'Customer'
  const backendStage = normalizeDeliveryStage(order?.deliveryStage)
  const canResendOtp =
    !order?.deliveryOtpVerified &&
    (backendStage === 'otp_pending' || backendStage === 'out_for_delivery')
  const address = formatDeliveryAddress(order?.shippingAddress)
  const hasProof = Boolean(order?.proofPhotoUrl)

  if (uiStage === 'delivered') {
    return (
      <DeliveredSuccess order={order} nextOrderId={nextOrderId} listPath={listPath} />
    )
  }

  return (
    <div className={DELIVERY_CANVAS}>
      <div className={DELIVERY_SHELL}>
        <header className={`${DELIVERY_CARD} ${DELIVERY_CARD_PAD}`}>
          <Link to={listPath} className={`${DELIVERY_LINK} mb-4`}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to deliveries
          </Link>
          <div className="flex items-start justify-between gap-3 border-b border-[#e7e7e7] pb-4">
            <div className="min-w-0">
              <p className={DELIVERY_LABEL}>Order</p>
              <h1 className="mt-1 truncate font-mono text-lg font-semibold text-[#0f1111]">{order.id}</h1>
            </div>
            <DeliveryStageBadge uiStage={uiStage} reached={reached} />
          </div>
          <p className="mt-4 text-lg font-semibold leading-tight text-[#0f1111]">{customerName}</p>
          <p className="mt-2 flex gap-2 text-sm leading-snug text-[#565959]">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-flare" aria-hidden />
            {address}
          </p>
          {order?.customerPhone ? (
            <p className="mt-2 font-mono text-sm text-[#565959]">{order.customerPhone}</p>
          ) : null}
        </header>

        {error ? (
          <div
            className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm"
            role="alert"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        <section className={`${DELIVERY_CARD} ${DELIVERY_CARD_PAD}`}>
          <h2 className={DELIVERY_LABEL}>Progress</h2>
          <div className="mt-3">
            <DeliveryWorkflowTimeline order={order} uiStage={uiStage} />
          </div>
        </section>

        <section className={`${DELIVERY_CARD} ${DELIVERY_CARD_PAD} space-y-4`}>
          {uiStage === 'assigned' ? (
            <button type="button" className={DELIVERY_PRIMARY_BTN} disabled={busy} onClick={() => void run('accept')}>
              {busy ? 'Please wait…' : 'Accept assignment'}
            </button>
          ) : null}

          {uiStage === 'accepted' ? (
            <button type="button" className={DELIVERY_PRIMARY_BTN} disabled={busy} onClick={() => void run('out')}>
              {busy ? 'Please wait…' : 'Start delivery'}
            </button>
          ) : null}

          {uiStage === 'out_for_delivery' ? (
            <>
              <ContactActions tel={tel} wa={wa} maps={maps} />
              {canResendOtp ? (
                <>
                  <button
                    type="button"
                    className={DELIVERY_SECONDARY_BTN}
                    disabled={busy}
                    onClick={() => void run('resend')}
                  >
                    {busy ? 'Sending…' : 'Resend OTP'}
                  </button>
                  {resendSuccess ? (
                    <p className="text-center text-sm font-medium text-[#067d62]">
                      New OTP sent to customer.
                    </p>
                  ) : null}
                </>
              ) : null}
              <button type="button" className={DELIVERY_PRIMARY_BTN} disabled={busy} onClick={confirmReached}>
                I have reached
              </button>
              <p className="text-center text-xs text-[#565959]">
                Tap when you arrive — then verify the customer OTP.
              </p>
            </>
          ) : null}

          {uiStage === 'otp_pending' ? (
            <>
              <ContactActions tel={tel} wa={wa} maps={maps} />
              {canResendOtp ? (
                <>
                  <button
                    type="button"
                    className={DELIVERY_SECONDARY_BTN}
                    disabled={busy}
                    onClick={() => void run('resend')}
                  >
                    {busy ? 'Sending…' : 'Resend OTP'}
                  </button>
                  {resendSuccess ? (
                    <p className="text-center text-sm font-medium text-[#067d62]">
                      New OTP sent to customer.
                    </p>
                  ) : null}
                </>
              ) : null}
              <div className="rounded-xl border border-[#d5d9d9] bg-[#fafafa] p-4">
                <label htmlFor="delivery-otp" className="text-sm font-semibold text-[#0f1111]">
                  Customer OTP
                </label>
                <p className="mt-1 text-xs text-[#565959]">Enter the 6-digit code from the customer.</p>
                <input
                  id="delivery-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="• • • • • •"
                  className={`mt-3 h-14 w-full rounded-lg border border-[#d5d9d9] bg-white text-center font-mono text-2xl tracking-[0.35em] text-[#0f1111] ${DELIVERY_INPUT_FOCUS}`}
                />
                <button
                  type="button"
                  className={`${DELIVERY_PRIMARY_BTN} mt-4`}
                  disabled={busy || otpInput.length !== 6}
                  onClick={() => void run('verify')}
                >
                  {busy ? 'Verifying…' : 'Verify OTP'}
                </button>
              </div>
            </>
          ) : null}

          {(uiStage === 'proof' || uiStage === 'ready_deliver') && hasProof ? (
            <div className="overflow-hidden rounded-lg border border-[#d5d9d9] bg-[#fafafa]">
              <AuthenticatedApiImage
                path={order.proofPhotoUrl}
                alt="Proof of delivery"
                className="max-h-72 w-full object-cover"
              />
            </div>
          ) : null}

          {uiStage === 'proof' ? (
            <>
              <p className="text-center text-sm text-[#565959]">OTP verified. Upload proof of delivery.</p>
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d5d9d9] bg-[#fafafa] p-6">
                <Camera className="h-10 w-10 text-[#888c8c]" aria-hidden />
                <p className="mt-2 text-sm font-medium text-[#0f1111]">Proof photo required</p>
                <p className="mt-1 text-xs text-[#565959]">JPEG, PNG or WebP · max 5 MB</p>
                <button
                  type="button"
                  className={`${DELIVERY_PRIMARY_BTN} mt-4 max-w-xs`}
                  disabled={busy}
                  onClick={() => proofInputRef.current?.click()}
                >
                  {busy ? 'Uploading…' : 'Upload proof photo'}
                </button>
                <input
                  ref={proofInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void uploadProof(file)
                  }}
                />
              </div>
            </>
          ) : null}

          {uiStage === 'ready_deliver' ? (
            <button type="button" className={DELIVERY_PRIMARY_BTN} disabled={busy} onClick={() => void run('delivered')}>
              {busy ? 'Completing…' : 'Mark delivered'}
            </button>
          ) : null}

          {uiStage === 'failed' ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
              <p className="font-semibold">Delivery marked as failed</p>
              {order?.deliveryFailedReasonLabel ? (
                <p className="mt-1">{order.deliveryFailedReasonLabel}</p>
              ) : null}
              <Link to={listPath} className={`${DELIVERY_PRIMARY_BTN} mt-4`}>
                Back to deliveries
              </Link>
            </div>
          ) : null}

          {['out_for_delivery', 'otp_pending', 'proof', 'accepted'].includes(uiStage) ? (
            <div className="border-t border-[#e7e7e7] pt-4">
              {!showFailForm ? (
                <button
                  type="button"
                  className={DELIVERY_GHOST_BTN}
                  disabled={busy}
                  onClick={() => setShowFailForm(true)}
                >
                  Report delivery issue
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/80 p-4">
                  <select
                    value={failReason}
                    onChange={(e) => setFailReason(e.target.value)}
                    className={`h-12 w-full rounded-lg border border-[#d5d9d9] bg-white px-3 text-sm text-[#0f1111] ${DELIVERY_INPUT_FOCUS}`}
                  >
                    {DELIVERY_FAILED_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {failReason === 'other' ? (
                    <input
                      type="text"
                      value={failNote}
                      onChange={(e) => setFailNote(e.target.value)}
                      placeholder="Describe the issue"
                      className={`h-12 w-full rounded-lg border border-[#d5d9d9] bg-white px-3 text-sm ${DELIVERY_INPUT_FOCUS}`}
                    />
                  ) : null}
                  <button type="button" className={DELIVERY_GHOST_BTN} disabled={busy} onClick={() => void run('failed')}>
                    Submit failure report
                  </button>
                  <button
                    type="button"
                    className="w-full text-center text-xs font-medium text-[#565959] hover:text-[#0f1111]"
                    onClick={() => setShowFailForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </section>

        <p className="pb-2 text-center font-mono text-[10px] text-[#888c8c]">
          Assigned {formatDateTime(order?.assignedDeliveryAt)}
        </p>
      </div>
    </div>
  )
}
