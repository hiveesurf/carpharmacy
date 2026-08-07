import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatInr } from '../../data/partsCatalog'
import { useCart } from '../../context/useCart'
import { markBuyNowCheckout } from '../../lib/checkoutSession.js'
import { resolvePartDisplayGallery } from '../../lib/productImage.js'
import { SafeImg } from '../ui/SafeImg'
import { Button } from '../ui/Button'
import { CartQtyStepper, PART_CARD_CTA_PILL } from '../cart/CartQtyStepper'

function specRows(part) {
  return [
    { label: 'Brand', value: part.brand },
    { label: 'Part number', value: part.partNumber },
    { label: 'Unit / volume', value: part.unitVolume },
    { label: 'Supplier', value: part.supplierName },
  ].filter((r) => r.value != null && String(r.value).trim() !== '')
}

/**
 * Shared product detail body (gallery, specs, fitment, cart actions).
 * @param {{ part: object, showKeepBrowsing?: boolean, onKeepBrowsing?: () => void }} props
 */
export function PartDetailContent({ part, showKeepBrowsing = false, onKeepBrowsing }) {
  const navigate = useNavigate()
  const { getQty, addToCart, replaceCartWith } = useCart()
  const qty = getQty(part.id)
  const leftInStock = Math.max(0, part.totalStock - qty)
  const canAdd = leftInStock > 0

  const galleryItems = useMemo(() => {
    return resolvePartDisplayGallery(part).map((item, i) => ({
      key: `img-${i}`,
      src: item.src,
      alt: item.alt,
    }))
  }, [part])

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  useEffect(() => {
    setSelectedImageIndex(0)
  }, [part.id])

  useEffect(() => {
    setSelectedImageIndex((i) => Math.min(i, Math.max(0, galleryItems.length - 1)))
  }, [galleryItems.length])

  const primaryImage = galleryItems[selectedImageIndex] ?? galleryItems[0]
  const specs = specRows(part)
  const description =
    typeof part.description === 'string' && part.description.trim()
      ? part.description.trim()
      : null

  const fitmentItems = useMemo(() => {
    if (!part?.compatibleCars?.length) return []
    const cars = part.compatibleCars
    const onlyAll = cars.length === 1 && String(cars[0]).toLowerCase() === 'all vehicles'
    if (onlyAll) return [{ label: cars[0], allVehicles: true }]
    return cars.map((c) => ({ label: String(c), allVehicles: false }))
  }, [part])

  async function buyNow() {
    if (!canAdd) return
    await replaceCartWith(part.id, 1)
    if (getQty(part.id) <= 0) return
    markBuyNowCheckout(part.id)
    navigate('/checkout')
  }

  const displayPrice =
    part.discountedPrice != null && part.discountedPrice < part.price
      ? part.discountedPrice
      : part.price

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
        <div className="lg:col-span-5">
          <div className="overflow-hidden rounded-xl border border-steel/70 bg-slate/40 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.35)]">
            <div className="relative aspect-square w-full sm:aspect-[4/3]">
              {primaryImage ? (
                <SafeImg
                  key={primaryImage.src}
                  src={primaryImage.src}
                  alt={primaryImage.alt}
                  fw={960}
                  fh={960}
                  className="h-full w-full object-contain bg-void/30"
                  width={960}
                  height={960}
                  loading="eager"
                />
              ) : null}
            </div>
          </div>
          {galleryItems.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {galleryItems.map((item, idx) => (
                <button
                  key={`${part.id}-thumb-${item.key}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  aria-label={`View image ${idx + 1}`}
                  aria-pressed={selectedImageIndex === idx}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:h-[72px] sm:w-[72px] ${
                    selectedImageIndex === idx
                      ? 'border-accent ring-1 ring-accent/40'
                      : 'border-steel/70 hover:border-accent/35'
                  }`}
                >
                  <SafeImg
                    key={item.src}
                    src={item.src}
                    alt=""
                    fw={144}
                    fh={144}
                    className="h-full w-full object-cover"
                    width={144}
                    height={144}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-4">
          <div>
            <h1 className="font-display text-xl font-bold uppercase leading-snug tracking-wide text-fog sm:text-2xl lg:text-[1.65rem]">
              {part.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-baseline gap-3 lg:hidden">
              {part.discountedPrice != null && part.discountedPrice < part.price ? (
                <>
                  <span className="font-mono text-lg text-mist line-through">{formatInr(part.price)}</span>
                  <span className="font-mono text-2xl font-semibold tabular-nums text-accent">
                    {formatInr(displayPrice)}
                  </span>
                </>
              ) : (
                <span className="font-mono text-2xl font-semibold tabular-nums text-accent">
                  {formatInr(displayPrice)}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1 font-mono text-xs text-mist">
            <p>
              <span className="text-hud">SKU</span> <span className="text-fog">{part.sku || '—'}</span>
            </p>
            {part.category ? (
              <p>
                <span className="text-hud">Category</span> <span className="text-fog">{part.category}</span>
              </p>
            ) : null}
          </div>

          {specs.length > 0 ? (
            <div className="rounded-xl border border-steel/60 bg-slate/30 px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-hud">Specifications</p>
              <dl className="mt-3 space-y-2 font-sans text-sm">
                {specs.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4">
                    <dt className="text-mist">{row.label}</dt>
                    <dd className="text-right font-medium text-fog">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {fitmentItems.length > 0 ? (
            <div className="rounded-xl border border-steel/60 bg-slate/30 px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-hud">Compatibility</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {fitmentItems.map((item, i) => (
                  <span
                    key={`${part.id}-fit-${i}`}
                    className="inline-flex rounded-full border border-steel/70 bg-ink/50 px-3 py-1 font-sans text-xs font-medium text-fog"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="font-sans text-sm text-mist">Compatibility: Not available</p>
          )}

          <div className="rounded-xl border border-steel/60 bg-slate/30 px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-hud">Description</p>
            <p className="mt-3 font-sans text-base leading-relaxed text-mist">
              {description ?? 'Not available'}
            </p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-[calc(var(--nav-h)+1rem)] lg:col-span-3 lg:self-start">
          <div className="rounded-2xl border border-steel/70 bg-ink/95 p-5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)]">
            <div className="hidden lg:block">
              {part.discountedPrice != null && part.discountedPrice < part.price ? (
                <div className="mb-4">
                  <p className="font-mono text-sm text-mist line-through">{formatInr(part.price)}</p>
                  <p className="font-mono text-3xl font-bold tabular-nums text-accent">
                    {formatInr(displayPrice)}
                  </p>
                </div>
              ) : (
                <p className="mb-4 font-mono text-3xl font-bold tabular-nums text-accent">
                  {formatInr(displayPrice)}
                </p>
              )}
            </div>
            {part.totalStock <= 0 ? (
              <p className="font-sans text-sm font-semibold text-flare">Out of stock</p>
            ) : leftInStock <= 0 ? (
              <p className="font-sans text-sm text-mist">Maximum quantity in cart</p>
            ) : null}
            <div className="mt-6 flex flex-col gap-3 border-t border-steel/60 pt-6">
              {qty <= 0 ? (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  type="button"
                  disabled={!canAdd}
                  onClick={() => addToCart(part.id, 1)}
                >
                  Add to cart
                </Button>
              ) : (
                <CartQtyStepper partId={part.id} maxStock={part.totalStock} className="w-full" />
              )}
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => void buyNow()}
                className={PART_CARD_CTA_PILL}
              >
                Buy now
              </button>
              {showKeepBrowsing && onKeepBrowsing ? (
                <Button variant="ghost" size="lg" type="button" className="w-full" onClick={onKeepBrowsing}>
                  Keep browsing
                </Button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
