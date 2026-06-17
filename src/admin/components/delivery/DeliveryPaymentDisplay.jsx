import {
  AMOUNT_UNAVAILABLE_LABEL,
  resolveDeliveryPayment,
  resolveDeliveryPaymentView,
} from '../../../lib/deliveryPayment.js'

const BADGE_PAID =
  'inline-flex items-center rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white'

const BADGE_COD =
  'inline-flex items-center rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white'

const BADGE_ONLINE =
  'inline-flex items-center rounded-md bg-[#565959] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white'

const BADGE_UNKNOWN =
  'inline-flex items-center rounded-md bg-steel/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white'

const LABEL = 'font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#565959]'

const AMOUNT_CARD =
  'rounded-xl border border-flare/35 bg-flare-muted/50 px-4 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'

/**
 * Payment badge only (list / compact surfaces).
 * @param {{ order: object }} props
 */
export function DeliveryPaymentBadge({ order }) {
  const pay = resolveDeliveryPayment(order)
  if (pay.kind === 'paid') return <span className={BADGE_PAID}>{pay.badgeText}</span>
  if (pay.kind === 'cod') return <span className={BADGE_COD}>{pay.badgeText}</span>
  if (pay.badgeText === 'Unknown') return <span className={BADGE_UNKNOWN}>{pay.badgeText}</span>
  return <span className={BADGE_ONLINE}>{pay.badgeText}</span>
}

/**
 * Full payment summary for delivery details (before completion actions).
 * @param {{ order: object }} props
 */
export function DeliveryPaymentSummary({ order }) {
  const view = resolveDeliveryPaymentView(order)

  return (
    <div className="space-y-3">
      <p className={LABEL}>Payment</p>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className={LABEL}>Payment method</dt>
          <dd className="mt-1 text-sm font-semibold text-[#0f1111]">{view.paymentMethodLabel}</dd>
        </div>
        <div>
          <dt className={LABEL}>Payment status</dt>
          <dd className="mt-1 text-sm font-semibold text-[#0f1111]">{view.paymentStatusLabel}</dd>
        </div>
      </dl>

      {view.noCollectionRequired ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          No cash collection required
        </p>
      ) : null}

      {view.showAmountCard && view.amountCardTitle ? (
        <div className={AMOUNT_CARD}>
          <p className={LABEL}>{view.amountCardTitle}</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums tracking-tight text-flare sm:text-3xl">
            {view.amountAvailable ? view.amountLabel : AMOUNT_UNAVAILABLE_LABEL}
          </p>
        </div>
      ) : null}

      {view.showCollectedAmount && !view.showAmountCard ? (
        <div>
          <p className={LABEL}>Amount collected</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[#0f1111]">
            {view.amountAvailable ? view.amountLabel : AMOUNT_UNAVAILABLE_LABEL}
          </p>
        </div>
      ) : null}

      {view.collectedAtLabel ? (
        <p className="text-xs text-[#565959]">
          Collected at: <span className="font-medium text-[#0f1111]">{view.collectedAtLabel}</span>
        </p>
      ) : null}

      {view.warningMessage ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
          {view.warningMessage}
        </p>
      ) : null}
    </div>
  )
}

/**
 * @param {{ order: object, layout?: 'inline' | 'stack' | 'compact' | 'summary', showPaymentLabel?: boolean }} props
 */
export function DeliveryPaymentDisplay({ order, layout = 'stack', showPaymentLabel = true }) {
  const pay = resolveDeliveryPayment(order)
  const view = resolveDeliveryPaymentView(order)
  const badge = <DeliveryPaymentBadge order={order} />

  if (layout === 'summary') {
    return <DeliveryPaymentSummary order={order} />
  }

  if (layout === 'compact') {
    return (
      <div className="flex flex-col items-end gap-0.5">
        {badge}
        {view.showCollectionAmount && view.amountAvailable ? (
          <p className="text-[10px] font-semibold tabular-nums text-[#0f1111]">{view.amountLabel}</p>
        ) : null}
      </div>
    )
  }

  if (layout === 'inline') {
    return (
      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {showPaymentLabel ? <span className="text-[#565959]">Payment:</span> : null}
          {badge}
          <span className="text-xs text-[#565959]">{view.paymentStatusLabel}</span>
        </div>
        {view.showCollectionAmount && view.amountAvailable ? (
          <p className="text-xs text-[#565959]">
            Amount to collect:{' '}
            <span className="text-sm font-bold tabular-nums text-[#0f1111]">{view.amountLabel}</span>
          </p>
        ) : null}
        {view.noCollectionRequired ? (
          <p className="text-xs font-medium text-emerald-800">No cash collection required</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="text-right">
      {showPaymentLabel ? <p className={LABEL}>Payment</p> : null}
      <div className={showPaymentLabel ? 'mt-1 flex flex-col items-end gap-1' : 'flex flex-col items-end gap-1'}>
        {badge}
        <p className="text-xs text-[#565959]">{view.paymentStatusLabel}</p>
        {view.showCollectionAmount ? (
          <p className="text-sm font-bold tabular-nums text-[#0f1111]">
            {view.amountAvailable ? view.amountLabel : AMOUNT_UNAVAILABLE_LABEL}
          </p>
        ) : null}
      </div>
    </div>
  )
}
