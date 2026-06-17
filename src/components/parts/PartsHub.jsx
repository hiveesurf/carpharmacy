import { useCallback, useEffect, useMemo, useState } from 'react'
import { catalogHref } from '../../lib/partBrand.js'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Heart, Search } from 'lucide-react'
import {
  CAR_MODEL_OPTIONS,
  PARTS_CATALOG,
  PARTS_HOME_PREVIEW_LIMIT,
  formatInr,
  getPartById,
} from '../../data/partsCatalog'
import { useCart } from '../../context/useCart'
import { markBuyNowCheckout } from '../../lib/checkoutSession.js'
import { useAuth } from '../../context/useAuth'
import { SafeImg } from '../ui/SafeImg'
import { Section } from '../ui/Section'
import { CartQtyStepperOrAdd, PART_CARD_CTA_PILL } from '../cart/CartQtyStepper'
import { staggerContainer, staggerItem, viewportOnce } from '../../lib/motion'
import { PartsLoadingScreen } from './PartsLoadingScreen'
import { PartDetailOverlay } from './PartDetailOverlay'
import { sectionBackdrops } from '../../content/media'
import { apiV1Base } from '../../api/client.js'
import { fetchProducts, fetchProductById } from '../../services/productService.js'
import { loadWishlist, toggleWishlistProduct } from '../../services/wishlistService.js'
import { mapApiProductToPart } from '../../lib/mapApiProduct.js'
import { partDisplayImage } from '../../lib/productImage.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import { ApiSectionError } from '../ui/ApiSectionError'

function readPartIdFromHash() {
  if (typeof window === 'undefined') return null
  const m = /^#part=(.+)$/.exec(window.location.hash)
  return m ? decodeURIComponent(m[1]) : null
}

export function PartsHub() {
  const useApi = Boolean(apiV1Base())
  const { user, openAuth, authHydrated } = useAuth()
  const [query, setQuery] = useState('')
  const [carFilter, setCarFilter] = useState('All vehicles')
  const [catalogReadyLocal, setCatalogReadyLocal] = useState(false)
  const [apiParts, setApiParts] = useState([])
  const [apiLoading, setApiLoading] = useState(useApi)
  const [apiError, setApiError] = useState(null)
  const [hubRetryKey, setHubRetryKey] = useState(0)
  const [detailId, setDetailId] = useState(readPartIdFromHash)
  const [detailResolved, setDetailResolved] = useState(null)
  const [detailRemote, setDetailRemote] = useState(null)
  const [detailRetryKey, setDetailRetryKey] = useState(0)
  const [wishIds, setWishIds] = useState(() => new Set())
  const navigate = useNavigate()
  const { getQty, addToCart, replaceCartWith } = useCart()

  const catalogReady = useApi ? !apiLoading : catalogReadyLocal

  useEffect(() => {
    if (useApi) return
    const t = window.setTimeout(() => setCatalogReadyLocal(true), 1200)
    return () => window.clearTimeout(t)
  }, [useApi])

  useEffect(() => {
    if (!useApi) return
    let cancel = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag before async fetch
    setApiLoading(true)
    setApiError(null)
    fetchProducts({ type: 'part', page: 0, pageSize: 24 })
      .then((d) => {
        if (!cancel) {
          setApiParts((d.items || []).map(mapApiProductToPart))
          setApiLoading(false)
          setApiError(null)
        }
      })
      .catch((e) => {
        if (!cancel) {
          setApiParts([])
          setApiLoading(false)
          setApiError(getFetchErrorMessage(e))
        }
      })
    return () => {
      cancel = true
    }
  }, [useApi, hubRetryKey])

  useEffect(() => {
    if (!authHydrated || !user || !useApi) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear wishlist when logged out
      setWishIds(new Set())
      return
    }
    let cancel = false
    loadWishlist()
      .then((items) => {
        if (!cancel) setWishIds(new Set((items || []).map((p) => p.id)))
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [authHydrated, user, useApi])

  useEffect(() => {
    if (!detailId || !useApi) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset overlay payload when closed
      setDetailResolved(null)
      setDetailRemote(null)
      return
    }
    let cancel = false
    setDetailRemote({ state: 'loading' })
    setDetailResolved(null)
    fetchProductById(detailId)
      .then((p) => {
        if (cancel) return
        if (p) {
          setDetailResolved(mapApiProductToPart(p))
          setDetailRemote({ state: 'ready' })
        } else {
          setDetailRemote({ state: 'error', message: 'Product not found.' })
        }
      })
      .catch((e) => {
        if (!cancel) setDetailRemote({ state: 'error', message: getFetchErrorMessage(e) })
      })
    return () => {
      cancel = true
    }
  }, [detailId, useApi, detailRetryKey])

  useEffect(() => {
    const onHash = () => setDetailId(readPartIdFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const syncHash = useCallback((id) => {
    const base = `${window.location.pathname}${window.location.search}`
    if (id) window.history.replaceState(null, '', `${base}#part=${encodeURIComponent(id)}`)
    else window.history.replaceState(null, '', base)
  }, [])

  const openDetail = useCallback(
    (id) => {
      if (useApi) {
        setDetailId(id)
        syncHash(id)
        return
      }
      if (!getPartById(id)) return
      setDetailId(id)
      syncHash(id)
    },
    [syncHash, useApi],
  )

  const closeDetail = useCallback(() => {
    setDetailId(null)
    syncHash(null)
  }, [syncHash])

  const sourceParts = useApi ? apiParts : PARTS_CATALOG

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sourceParts.filter((p) => {
      const matchesCar =
        carFilter === 'All vehicles' ||
        p.compatibleCars.includes('All vehicles') ||
        p.compatibleCars.includes(carFilter)
      if (!matchesCar) return false
      if (!q) return true
      const brand = (p.brand ?? '').toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        brand.includes(q) ||
        p.compatibleCars.some((c) => c.toLowerCase().includes(q))
      )
    })
  }, [sourceParts, query, carFilter])

  const previewList = filtered.slice(0, PARTS_HOME_PREVIEW_LIMIT)

  const resolvedForOverlay = useApi ? detailResolved : detailId ? getPartById(detailId) : null

  const onWishToggle = async (e, partId) => {
    e.stopPropagation()
    if (!useApi) return
    if (!user) {
      openAuth()
      return
    }
    try {
      const data = await toggleWishlistProduct(partId)
      setWishIds((prev) => {
        const next = new Set(prev)
        if (data.inWishlist) next.add(partId)
        else next.delete(partId)
        return next
      })
    } catch {
      /* ignore */
    }
  }

  const viewAllHref = useMemo(() => {
    const tokens = [query.trim()]
    if (carFilter !== 'All vehicles') tokens.push(carFilter)
    return catalogHref({ q: tokens.filter(Boolean).join(' ').trim() || undefined })
  }, [query, carFilter])

  const viewAll = (
    <Link
      to={viewAllHref}
      className="inline-flex items-center gap-1 rounded-xl bg-accent px-5 py-2.5 font-sans text-sm font-semibold text-on-accent shadow-md transition-[transform,filter] hover:brightness-95 active:scale-[0.98]"
    >
      View all
      <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
    </Link>
  )

  return (
    <Section
      id="parts"
      eyebrow="Marketplace"
      title="Featured products"
      subtitle="OEM-style listings with live stock — tap a card for full fitment and gallery."
      titleAction={viewAll}
      className="border-b border-steel/60 bg-slate"
      backdrop={sectionBackdrops.parts}
    >
      <PartDetailOverlay
        partId={detailId}
        resolvedPart={resolvedForOverlay}
        remoteLoadState={useApi && detailId ? detailRemote?.state : undefined}
        remoteErrorMessage={detailRemote?.message}
        onRetryRemote={() => setDetailRetryKey((k) => k + 1)}
        onClose={closeDetail}
        onOpenPart={openDetail}
      />

      {!catalogReady ? (
        <PartsLoadingScreen />
      ) : (
        <>
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mist"
                strokeWidth={1.5}
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search parts, SKU, category…"
                className="w-full rounded-xl border border-steel/80 bg-ink py-3.5 pl-12 pr-4 font-sans text-fog shadow-sm outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/20"
                aria-label="Search parts"
              />
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <label className="font-sans text-xs font-semibold uppercase tracking-wider text-mist sm:mr-2 sm:mt-0">
                Vehicle
              </label>
              <select
                value={carFilter}
                onChange={(e) => setCarFilter(e.target.value)}
                className="w-full min-w-[220px] cursor-pointer rounded-xl border border-steel/80 bg-ink py-3 pl-3 pr-8 font-sans text-sm text-fog shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 sm:w-64"
                aria-label="Filter by vehicle"
              >
                {CAR_MODEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mb-8 font-sans text-sm text-mist">
            {apiError ? (
              <span className="text-flare">Featured products API unavailable</span>
            ) : (
              <>
                Showing <span className="font-semibold text-accent">{previewList.length}</span> of{' '}
                <span className="font-semibold text-accent">{filtered.length}</span> matching
                {useApi ? '' : ` of ${sourceParts.length}`} ·{' '}
                <span className="text-mist/90">Click a card for details</span>
              </>
            )}
          </p>

          {useApi && apiError ? (
            <ApiSectionError
              title="Featured products could not load"
              message={apiError}
              onRetry={() => setHubRetryKey((k) => k + 1)}
              className="mb-10"
            />
          ) : null}

          <motion.ul
            className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            viewport={viewportOnce}
          >
            {!apiError &&
              previewList.map((part) => {
              const img = partDisplayImage(part)
              const inCart = getQty(part.id)
              const left = Math.max(0, part.totalStock - inCart)
              const canAdd = left > 0
              const wished = wishIds.has(part.id)

              return (
                <motion.li key={part.id} variants={staggerItem}>
                  <motion.article
                    tabIndex={0}
                    aria-label={`${part.name} — view full details`}
                    className="ad-store-card group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-steel/70 bg-ink shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] outline-none transition-[transform,box-shadow] focus-visible:ring-2 focus-visible:ring-accent/50"
                    whileHover={{
                      y: -6,
                      boxShadow: '0 22px 44px -14px rgba(0, 51, 102, 0.2)',
                    }}
                    transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                    onClick={() => openDetail(part.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openDetail(part.id)
                      }
                    }}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate">
                      <SafeImg
                        src={img.src}
                        alt={img.alt}
                        fw={800}
                        fh={600}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        width={700}
                        height={525}
                        loading="lazy"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-steel/80 bg-ink/90 text-mist shadow-md backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"
                        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
                        onClick={(e) => onWishToggle(e, part.id)}
                      >
                        <Heart
                          className={`h-4 w-4 ${wished ? 'fill-accent text-accent' : ''}`}
                          strokeWidth={1.75}
                        />
                      </button>
                      <span className="absolute left-3 top-3 rounded-lg border border-steel/60 bg-ink/90 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-hud backdrop-blur-sm">
                        {part.category}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-mist">{part.sku}</p>
                      <h3 className="mt-1 font-display text-base font-bold uppercase leading-snug tracking-wide text-fog">
                        {part.name}
                      </h3>
                      <p className="mt-2 font-sans text-xl font-bold text-accent">{formatInr(part.price)}</p>

                      <div className="mt-3 space-y-2 rounded-lg border border-steel/60 bg-slate/80 px-3 py-2">
                        <div className="flex items-center justify-between gap-2 font-sans text-[11px] font-semibold uppercase tracking-wide text-mist">
                          <span className="text-hud">In stock</span>
                          <span className={`tabular-nums text-fog ${left === 0 ? 'text-flare' : ''}`}>
                            {left}/{part.totalStock}
                          </span>
                        </div>
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-steel/80"
                          role="progressbar"
                          aria-valuenow={left}
                          aria-valuemin={0}
                          aria-valuemax={part.totalStock}
                          aria-label={`${left} of ${part.totalStock} units available`}
                        >
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 ${
                              left === 0 ? 'bg-mist/50' : 'bg-accent'
                            }`}
                            style={{
                              width: `${part.totalStock ? Math.min(100, (left / part.totalStock) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-mist">
                        <span className="font-semibold text-hud">Fits: </span>
                        {part.compatibleCars.join(', ')}
                      </p>

                      <div
                        className="mt-auto grid grid-cols-1 gap-2 pt-5 min-[420px]:grid-cols-2 min-[420px]:gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CartQtyStepperOrAdd
                          partId={part.id}
                          maxStock={part.totalStock}
                          canAdd={canAdd}
                          pairedCardLayout
                        />
                        <button
                          type="button"
                          disabled={!canAdd}
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!canAdd) return
                            await replaceCartWith(part.id, 1)
                            if (getQty(part.id) <= 0) return
                            markBuyNowCheckout(part.id)
                            navigate('/checkout')
                          }}
                          className={PART_CARD_CTA_PILL}
                        >
                          Buy now
                        </button>
                      </div>
                    </div>
                  </motion.article>
                </motion.li>
              )
            })}
          </motion.ul>

          {!apiError && filtered.length === 0 && (
            <p className="py-16 text-center font-sans text-mist">
              No parts match this search and vehicle. Try “All vehicles” or clear the search.
            </p>
          )}
        </>
      )}
    </Section>
  )
}
