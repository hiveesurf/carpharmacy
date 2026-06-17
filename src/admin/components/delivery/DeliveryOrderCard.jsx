import { useNavigate } from 'react-router-dom'
import { Phone, MessageCircle, Navigation, ChevronRight } from 'lucide-react'
import { deriveDeliveryUiStage, formatDeliveryAddress } from '../../../lib/deliveryUiStage.js'
import { deliveryDetailPath } from '../../../lib/deliveryRoutes.js'
import { telHref, whatsAppHref, googleMapsDirectionsHref } from '../../../lib/deliveryLinks.js'
import { customerInitials, resolveDeliveryPayment, resolveDeliveryPaymentView } from '../../../lib/deliveryPayment.js'
import { DeliveryStageBadge } from './DeliveryStageBadge.jsx'
import { DeliveryPaymentBadge } from './DeliveryPaymentDisplay.jsx'

function formatAssignedTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const LABEL_BTN =
  'inline-flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-lg bg-[#f0f2f2] px-1.5 text-[11px] font-semibold text-[#0f1111] transition active:scale-[0.98] hover:bg-[#e4e6e6] sm:px-2 sm:text-xs'

const LABEL_BTN_DISABLED = `${LABEL_BTN} pointer-events-none opacity-40`

const OPEN_BTN =
  'inline-flex min-h-[32px] flex-[1.15] items-center justify-center gap-0.5 rounded-lg bg-flare px-2 text-[11px] font-bold text-on-accent shadow-[0_2px_8px_rgba(232,93,44,0.35)] transition active:scale-[0.98] hover:brightness-[1.03] sm:gap-1 sm:text-xs'

/**
 * @param {{ order: object }} props
 */
export function DeliveryOrderCard({ order }) {
  const navigate = useNavigate()
  const uiStage = deriveDeliveryUiStage(order)
  const customerName = order?.customerName?.trim() || 'Customer'
  const address = formatDeliveryAddress(order?.shippingAddress)
  const phone = order?.customerPhone
  const tel = telHref(phone)
  const wa = whatsAppHref(phone, `Hi, I am your delivery partner for order ${order?.id}.`)
  const maps = googleMapsDirectionsHref(order?.shippingAddress)
  const pay = resolveDeliveryPayment(order)
  const paymentView = resolveDeliveryPaymentView(order)

  return (
    <article className="overflow-hidden rounded-xl bg-white px-2.5 py-1.5 shadow-[0_1px_4px_rgba(15,17,17,0.08)] sm:px-3 sm:py-2">
      <div className="flex gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-flare text-[10px] font-bold text-on-accent sm:h-9 sm:w-9 sm:text-xs"
          aria-hidden
        >
          {customerInitials(customerName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-[#0f1111]">{customerName}</p>
              {phone ? (
                <p className="truncate font-mono text-[11px] leading-tight text-[#565959] sm:text-xs">{phone}</p>
              ) : null}
              <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-[#565959] sm:text-xs">{address}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <DeliveryStageBadge uiStage={uiStage} className="!text-[10px]" />
              <DeliveryPaymentBadge order={order} />
            </div>
          </div>

          <p className="mt-1 text-[10px] text-[#888c8c] sm:text-[11px]">
            Assigned {formatAssignedTime(order?.assignedDeliveryAt)}
            {paymentView.listLineText ? (
              <span className="text-[#565959]">
                {' '}
                · {paymentView.listLineText}
              </span>
            ) : pay.showAmountToCollect && pay.amountFormatted ? (
              <span className="text-[#565959]">
                {' '}
                · Collect <span className="font-bold tabular-nums text-[#0f1111]">{pay.amountFormatted}</span>
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-1 flex gap-1">
        {tel ? (
          <a href={tel} className={LABEL_BTN} onClick={(e) => e.stopPropagation()}>
            <Phone className="h-3.5 w-3.5 shrink-0 text-flare" aria-hidden />
            Call
          </a>
        ) : (
          <span className={LABEL_BTN_DISABLED}>
            <Phone className="h-3.5 w-3.5" aria-hidden />
            Call
          </span>
        )}
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={LABEL_BTN}
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-flare" aria-hidden />
            WhatsApp
          </a>
        ) : (
          <span className={LABEL_BTN_DISABLED}>
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            WhatsApp
          </span>
        )}
        {maps ? (
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            className={LABEL_BTN}
            onClick={(e) => e.stopPropagation()}
          >
            <Navigation className="h-3.5 w-3.5 shrink-0 text-flare" aria-hidden />
            Navigate
          </a>
        ) : (
          <span className={LABEL_BTN_DISABLED}>
            <Navigation className="h-3.5 w-3.5" aria-hidden />
            Navigate
          </span>
        )}
        <button type="button" className={OPEN_BTN} onClick={() => navigate(deliveryDetailPath(order.id))}>
          Open Delivery
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      </div>
    </article>
  )
}
