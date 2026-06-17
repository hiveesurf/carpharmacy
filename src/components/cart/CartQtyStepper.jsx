import { Minus, Plus } from 'lucide-react'
import { useCart } from '../../context/useCart'
import { Button } from '../ui/Button'

/** Matched “Add to cart” / “Buy now” pills on product cards (same size, orange, rounded). */
export const PART_CARD_CTA_PILL =
  'flex min-h-[3rem] w-full min-w-0 items-center justify-center whitespace-nowrap rounded-[1.25rem] bg-accent px-3 font-sans text-[11px] font-bold uppercase tracking-wide text-on-accent shadow-[0_8px_22px_-6px_rgba(255,107,53,0.5)] transition-[filter,transform] hover:brightness-[0.97] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45 sm:text-xs sm:px-4'

/** Outlined companion pill for “View details” on catalog cards (equal height to {@link PART_CARD_CTA_PILL}). */
export const PART_CARD_DETAILS_PILL =
  'flex min-h-[3rem] w-full min-w-0 items-center justify-center whitespace-nowrap rounded-[1.25rem] border border-accent/40 bg-accent/10 px-3 font-sans text-[11px] font-bold uppercase tracking-wide text-accent transition-colors hover:bg-accent/20 sm:text-xs sm:px-4'

/**
 * Compact − qty + control once a line exists in the cart.
 */
export function CartQtyStepper({ partId, maxStock, className = '' }) {
  const { getQty, setPartQty } = useCart()
  const qty = getQty(partId)
  if (qty <= 0) return null

  return (
    <div
      className={`inline-flex items-stretch overflow-hidden rounded-[1.25rem] border border-steel/80 bg-slate font-sans text-sm font-semibold text-fog ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex w-10 items-center justify-center border-r border-steel/60 transition-colors hover:bg-steel/50"
        aria-label="Decrease quantity"
        onClick={() => setPartQty(partId, qty - 1)}
      >
        <Minus className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <span className="flex min-w-[2.75rem] items-center justify-center px-2 font-semibold tabular-nums">{qty}</span>
      <button
        type="button"
        className="flex w-10 items-center justify-center border-l border-steel/60 transition-colors hover:bg-steel/50 disabled:opacity-35"
        aria-label="Increase quantity"
        disabled={qty >= maxStock}
        onClick={() => setPartQty(partId, qty + 1)}
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}

/**
 * Add to cart when empty; stepper when qty &gt; 0.
 * `pairedCardLayout`: use same pill as “Buy now” on home cards (equal width/height with sibling).
 */
export function CartQtyStepperOrAdd({ partId, maxStock, canAdd, className = '', pairedCardLayout = false }) {
  const { getQty, addToCart } = useCart()
  const qty = getQty(partId)

  if (qty <= 0) {
    if (pairedCardLayout) {
      return (
        <div className={`w-full min-w-0 ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={PART_CARD_CTA_PILL}
            disabled={!canAdd}
            onClick={() => addToCart(partId, 1)}
          >
            {canAdd ? 'Add to cart' : 'Sold out'}
          </button>
        </div>
      )
    }
    return (
      <div className={className} onClick={(e) => e.stopPropagation()}>
        <Button
          variant="primary"
          size="md"
          className="w-full sm:w-auto"
          type="button"
          disabled={!canAdd}
          onClick={() => addToCart(partId, 1)}
        >
          {canAdd ? 'Add to cart' : 'Sold out for cart'}
        </Button>
      </div>
    )
  }

  if (pairedCardLayout) {
    return (
      <div className={`w-full min-w-0 ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
        <CartQtyStepper partId={partId} maxStock={maxStock} className="h-12 min-h-[3rem] w-full min-w-0" />
      </div>
    )
  }

  return <CartQtyStepper partId={partId} maxStock={maxStock} className={className} />
}
