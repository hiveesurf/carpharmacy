import { useEffect, useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import {
  AMOUNT_UNAVAILABLE_LABEL,
  resolveDeliveryPaymentView,
} from '../../../lib/deliveryPayment.js'
import { DELIVERY_PRIMARY_BTN } from './deliveryTheme.js'

/**
 * @param {{
 *   open: boolean,
 *   order: object,
 *   busy?: boolean,
 *   onCancel: () => void,
 *   onConfirm: () => void,
 * }} props
 */
export function DeliveryCodConfirmDialog({ open, order, busy = false, onCancel, onConfirm }) {
  const view = resolveDeliveryPaymentView(order)
  const [checked, setChecked] = useState(false)
  const titleId = useId()
  const checkboxId = useId()

  useEffect(() => {
    if (open) setChecked(false)
  }, [open, order?.id])

  const confirmEnabled = view.canConfirmCashCollection && checked && !busy

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-ink/60 backdrop-blur-[2px]"
            aria-label="Close confirmation"
            onClick={busy ? undefined : onCancel}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="fixed left-1/2 top-1/2 z-[130] w-[min(100%,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#d5d9d9] bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-base font-bold text-[#0f1111]">
                Confirm cash collection
              </h2>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d5d9d9] text-[#565959] hover:bg-[#f7fafa] disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="space-y-3 text-sm text-[#565959]">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">Amount to collect</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-flare">
                  {view.amountAvailable ? view.amountLabel : AMOUNT_UNAVAILABLE_LABEL}
                </p>
              </div>

              {view.canConfirmCashCollection ? (
                <label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#e7e7e7] bg-[#f7fafa] px-3 py-3">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-flare"
                  />
                  <span className="text-sm leading-snug text-[#0f1111]">
                    I confirm that{' '}
                    <span className="font-bold tabular-nums text-flare">{view.amountLabel}</span> was collected from
                    the customer.
                  </span>
                </label>
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
                  {view.warningMessage ||
                    'Order total unavailable. Verify the order before completing delivery.'}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                className={`${DELIVERY_PRIMARY_BTN} sm:flex-1`}
                disabled={!confirmEnabled}
                onClick={onConfirm}
              >
                {busy ? 'Completing…' : 'Confirm collection and mark delivered'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-lg border border-[#d5d9d9] bg-white text-sm font-semibold uppercase tracking-wide text-[#565959] hover:bg-[#f7fafa] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
