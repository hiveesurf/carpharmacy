import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Heart, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  PARTS_CATALOG,
  PART_CATEGORY_OPTIONS,
  formatInr,
} from '../data/partsCatalog'
import { partDisplayImage } from '../lib/productImage.js'
import { useCart } from '../context/useCart'
import { useAuth } from '../context/useAuth'
import { SafeImg } from '../components/ui/SafeImg'
import { Button } from '../components/ui/Button'
import { CartQtyStepperOrAdd, PART_CARD_DETAILS_PILL } from '../components/cart/CartQtyStepper'
import { publicUrl } from '../lib/publicUrl'
import { apiV1Base } from '../api/client.js'
import { fetchProducts } from '../services/productService.js'
import { loadWishlist, toggleWishlistProduct } from '../services/wishlistService.js'
import { mapApiProductToPart } from '../lib/mapApiProduct.js'
import { partMatchesBrand } from '../lib/partBrand.js'
import { getFetchErrorMessage } from '../lib/apiErrorMessage.js'
import { ApiSectionError } from '../components/ui/ApiSectionError'
import { fetchVehicleBrands, fetchVehicleModels, fetchVehicleYears } from '../services/fitmentService.js'

const PAGE_SIZE = 24
const SEARCH_DEBOUNCE_MS = 350

export function PartsCatalogPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const catalogReturnPath = `${location.pathname}${location.search}`
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState(() => (searchParams.get('q') ?? '').trim())
  const [selectedCarId, setSelectedCarId] = useState(() => searchParams.get('carId') ?? '')
  const [brandId, setBrandId] = useState(() => searchParams.get('brandId') ?? '')
  const [modelId, setModelId] = useState('')
  const [year, setYear] = useState(() => searchParams.get('year') ?? '')
  const [fuelFilter, setFuelFilter] = useState(() => searchParams.get('fuel') ?? '')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedCategories, setSelectedCategories] = useState(() => {
    const cat = searchParams.get('category')
    return cat ? [cat] : []
  })
  const [partBrand, setPartBrand] = useState(
    () => searchParams.get('brand') ?? searchParams.get('partBrand') ?? '',
  )

  useEffect(() => {
    const q = searchParams.get('q')
    const cid = searchParams.get('carId') ?? ''
    const bid = searchParams.get('brandId') ?? ''
    const y = searchParams.get('year') ?? ''
    const fuel = searchParams.get('fuel') ?? ''
    const cat = searchParams.get('category') ?? ''
    const pb = searchParams.get('brand') ?? searchParams.get('partBrand') ?? ''
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route params hydrate local filters
    if (q != null) setQuery(q)
    setSelectedCarId(cid)
    setBrandId(bid)
    setYear(y)
    setFuelFilter(fuel)
    if (cid) setModelId(cid)
    setSelectedCategories(cat ? [cat] : [])
    setPartBrand(pb)
  }, [searchParams])

  const useApi = Boolean(apiV1Base())
  useEffect(() => {
    if (!useApi) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- local fallback sync
      setDebouncedQuery(query.trim())
      return
    }
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query, useApi])

  const { lineItems, itemCount, subtotal, openCart, cartError, cartLoading, retryCart } = useCart()
  const { user, openAuth, authHydrated } = useAuth()

  const [brandOptions, setBrandOptions] = useState([])
  const [modelOptions, setModelOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [apiParts, setApiParts] = useState([])
  const [apiTotal, setApiTotal] = useState(0)
  const [apiHasMore, setApiHasMore] = useState(false)
  const [apiNextPage, setApiNextPage] = useState(1)
  const [apiLoadingMore, setApiLoadingMore] = useState(false)
  const [apiLoading, setApiLoading] = useState(useApi)
  const [apiError, setApiError] = useState(null)
  const [catalogRetryKey, setCatalogRetryKey] = useState(0)
  const [wishIds, setWishIds] = useState(() => new Set())

  const selectedBrand = useMemo(() => brandOptions.find((b) => String(b.id) === String(brandId)) ?? null, [brandOptions, brandId])
  const selectedModel = useMemo(() => modelOptions.find((m) => String(m.id) === String(modelId)) ?? null, [modelOptions, modelId])

  useEffect(() => {
    if (!useApi) return
    let cancelled = false
    fetchVehicleBrands()
      .then((rows) => {
        if (!cancelled) setBrandOptions(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setBrandOptions([])
      })
    fetchVehicleYears()
      .then((rows) => {
        if (!cancelled) setYearOptions(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setYearOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [useApi])

  useEffect(() => {
    if (!useApi || !brandId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dependent options
      setModelOptions([])
      return
    }
    let cancelled = false
    fetchVehicleModels(String(brandId))
      .then((rows) => {
        if (!cancelled) setModelOptions(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setModelOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [useApi, brandId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset visible count after filter change
    setVisibleCount(PAGE_SIZE)
  }, [debouncedQuery, brandId, modelId, year, fuelFilter, selectedCategories, partBrand])

  const buildApiParams = useCallback(
    (pageIndex) => {
      const params = { type: 'part', page: pageIndex, pageSize: PAGE_SIZE }
      if (selectedCategories.length === 1) params.category = selectedCategories[0]
      if (modelId) {
        params.carId = modelId
      } else if (brandId && selectedBrand?.name) {
        params.carModel = selectedBrand.name
      } else if (selectedCarId) {
        params.carId = selectedCarId
      }
      const searchTokens = [debouncedQuery]
      if (fuelFilter.trim()) searchTokens.push(fuelFilter.trim())
      if (year) {
        const y = yearOptions.find((x) => String(x.id) === String(year))
        if (y?.label) searchTokens.push(String(y.label))
        else searchTokens.push(String(year))
      }
      const search = searchTokens.filter(Boolean).join(' ').trim()
      if (search) params.search = search
      if (partBrand.trim()) params.partBrand = partBrand.trim()
      return params
    },
    [
      selectedCategories,
      modelId,
      brandId,
      selectedBrand,
      selectedCarId,
      debouncedQuery,
      year,
      fuelFilter,
      yearOptions,
      partBrand,
    ],
  )

  useEffect(() => {
    if (!useApi) return
    let cancel = false
    setApiLoading(true)
    setApiLoadingMore(false)
    setApiError(null)
    fetchProducts(buildApiParams(0))
      .then((d) => {
        if (!cancel) {
          const rows = (d.items || []).map(mapApiProductToPart)
          setApiParts(rows)
          const total = typeof d.total === 'number' ? d.total : rows.length
          setApiTotal(total)
          const tp = typeof d.totalPages === 'number' ? d.totalPages : Math.max(1, Math.ceil(total / PAGE_SIZE))
          setApiHasMore(tp > 1)
          setApiNextPage(1)
          setApiLoading(false)
          setApiError(null)
        }
      })
      .catch((e) => {
        if (!cancel) {
          setApiParts([])
          setApiTotal(0)
          setApiHasMore(false)
          setApiNextPage(1)
          setApiLoading(false)
          setApiError(getFetchErrorMessage(e))
        }
      })
    return () => {
      cancel = true
    }
  }, [useApi, buildApiParams, catalogRetryKey])

  const loadMoreApi = useCallback(async () => {
    if (!useApi || apiLoading || apiLoadingMore || !apiHasMore) return
    setApiLoadingMore(true)
    setApiError(null)
    try {
      const d = await fetchProducts(buildApiParams(apiNextPage))
      const rows = (d.items || []).map(mapApiProductToPart)
      setApiParts((prev) => [...prev, ...rows])
      const total = typeof d.total === 'number' ? d.total : apiTotal
      setApiTotal(total)
      const tp = typeof d.totalPages === 'number' ? d.totalPages : Math.max(1, Math.ceil(total / PAGE_SIZE))
      const next = apiNextPage + 1
      setApiNextPage(next)
      setApiHasMore(next < tp)
    } catch (e) {
      setApiError(getFetchErrorMessage(e))
    } finally {
      setApiLoadingMore(false)
    }
  }, [useApi, apiLoading, apiLoadingMore, apiHasMore, apiNextPage, buildApiParams, apiTotal])

  useEffect(() => {
    if (!authHydrated || !user || !useApi) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear wishlist for logged-out state
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

  const onWishToggle = useCallback(
    async (e, partId) => {
      e.preventDefault()
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
    },
    [useApi, user, openAuth],
  )

  const filtered = useMemo(() => {
    if (useApi) {
      let rows = apiParts
      if (selectedCategories.length > 0) {
        rows = rows.filter((p) => selectedCategories.includes(p.category))
      }
      if (partBrand.trim()) {
        rows = rows.filter((p) => partMatchesBrand(p, partBrand))
      }
      return rows
    }
    const q = query.trim().toLowerCase()
    const brandText = selectedBrand?.name?.toLowerCase() ?? ''
    const oemBrand = partBrand.trim()
    const modelText = selectedModel?.name?.toLowerCase() ?? selectedModel?.fullName?.toLowerCase() ?? ''
    const yearText = yearOptions.find((y) => String(y.id) === String(year))?.label?.toLowerCase() ?? String(year || '')
    return PARTS_CATALOG.filter((p) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) return false
      if (oemBrand && !partMatchesBrand(p, oemBrand)) return false
      const fitmentJoined = p.compatibleCars.join(' ').toLowerCase()
      if (brandText && !fitmentJoined.includes(brandText) && !p.compatibleCars.includes('All vehicles')) return false
      if (modelText && !fitmentJoined.includes(modelText) && !p.compatibleCars.includes('All vehicles')) return false
      if (yearText && !fitmentJoined.includes(yearText) && !p.compatibleCars.includes('All vehicles')) return false
      if (fuelFilter.trim()) {
        const fuel = fuelFilter.trim().toLowerCase()
        if (!fitmentJoined.includes(fuel) && !p.compatibleCars.includes('All vehicles')) return false
      }
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.compatibleCars.some((c) => c.toLowerCase().includes(q))
      )
    })
  }, [useApi, apiParts, query, selectedCategories, selectedBrand, selectedModel, year, fuelFilter, yearOptions, partBrand])

  const pagedParts = useApi ? filtered : filtered.slice(0, visibleCount)
  const resultCount = useApi
    ? selectedCategories.length > 1
      ? filtered.length
      : apiTotal
    : filtered.length
  const hasMore = useApi ? apiHasMore : filtered.length > visibleCount

  const activeFilterChips = useMemo(() => {
    const chips = []
    selectedCategories.forEach((c) => chips.push({ key: `category:${c}`, label: c }))
    if (selectedBrand?.name) chips.push({ key: 'vehicleBrand', label: `Vehicle: ${selectedBrand.name}` })
    if (partBrand.trim()) chips.push({ key: 'oemBrand', label: `OEM: ${partBrand.trim()}` })
    if (selectedModel?.fullName || selectedModel?.name) chips.push({ key: 'model', label: `Model: ${selectedModel.fullName ?? selectedModel.name}` })
    if (year) {
      const y = yearOptions.find((x) => String(x.id) === String(year))
      chips.push({ key: 'year', label: `Year: ${y?.label ?? year}` })
    }
    if (debouncedQuery) chips.push({ key: 'query', label: `Search: ${debouncedQuery}` })
    if (fuelFilter) chips.push({ key: 'fuel', label: `Fuel: ${fuelFilter}` })
    return chips
  }, [selectedCategories, selectedBrand, selectedModel, year, yearOptions, debouncedQuery, fuelFilter, partBrand])

  const clearAllFilters = useCallback(() => {
    setSelectedCategories([])
    setBrandId('')
    setModelId('')
    setYear('')
    setFuelFilter('')
    setQuery('')
    setDebouncedQuery('')
    setPartBrand('')
    setSelectedCarId('')
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('brandId')
      next.delete('carId')
      next.delete('q')
      next.delete('year')
      next.delete('fuel')
      next.delete('category')
      next.delete('brand')
      next.delete('partBrand')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const removeChip = useCallback((chipKey) => {
    if (chipKey.startsWith('category:')) {
      const categoryName = chipKey.split(':').slice(1).join(':')
      setSelectedCategories((prev) => {
        const next = prev.filter((c) => c !== categoryName)
        setSearchParams((sp) => {
          const params = new URLSearchParams(sp)
          if (next.length === 1) params.set('category', next[0])
          else params.delete('category')
          return params
        }, { replace: true })
        return next
      })
    }
    if (chipKey === 'vehicleBrand') {
      setBrandId('')
      setModelId('')
      setYear('')
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('brandId')
        return next
      }, { replace: true })
    }
    if (chipKey === 'oemBrand') {
      setPartBrand('')
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('brand')
        next.delete('partBrand')
        return next
      }, { replace: true })
    }
    if (chipKey === 'model') {
      setModelId('')
      setYear('')
    }
    if (chipKey === 'year') setYear('')
    if (chipKey === 'fuel') {
      setFuelFilter('')
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('fuel')
        return next
      }, { replace: true })
    }
    if (chipKey === 'query') {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [setSearchParams])

  const onCategoriesChange = useCallback(
    (cats) => {
      setSelectedCategories(cats)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (cats.length === 1) next.set('category', cats[0])
        else next.delete('category')
        return next
      }, { replace: true })
    },
    [setSearchParams],
  )

  const noModelAvailable = Boolean(brandId) && modelOptions.length === 0 && !apiLoading
  const noYearAvailable = Boolean(modelId) && yearOptions.length === 0 && !apiLoading

  return (
    <div className="relative min-h-svh overflow-hidden bg-slate pt-[calc(var(--nav-h)+1rem)] pb-16">
      <img
        src={publicUrl('images/engine.jpg')}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
        loading="lazy"
        decoding="async"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-slate/75" aria-hidden />
      <div className="relative z-[1] mx-auto flex max-w-[1680px] flex-col gap-8 px-4 lg:flex-row lg:gap-6 lg:px-6 xl:px-10">
        <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-[calc(var(--nav-h)+1rem)] lg:w-64 lg:self-start xl:w-72">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-hud transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Back to home
          </Link>
          <div className="hidden lg:block">
            <CatalogFiltersPanel
              useApi={useApi}
              selectedCategories={selectedCategories}
              setSelectedCategories={onCategoriesChange}
              brandId={brandId}
              setBrandId={setBrandId}
              modelId={modelId}
              setModelId={setModelId}
              year={year}
              setYear={setYear}
              brandOptions={brandOptions}
              modelOptions={modelOptions}
              yearOptions={yearOptions}
              noModelAvailable={noModelAvailable}
              noYearAvailable={noYearAvailable}
              clearAllFilters={clearAllFilters}
              resultCount={resultCount}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#d8dce3] bg-white/95 p-4 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.2)] md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" strokeWidth={1.5} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by part code, name, category..."
                className="w-full rounded-xl border border-[#d8dce3] bg-white py-3 pl-10 pr-3 font-sans text-sm text-[#1a1d24] outline-none transition-[border-color,box-shadow] placeholder:text-[#9aa0a8] focus:border-[#f15a24] focus:ring-2 focus:ring-[#f15a24]/20"
                aria-label="Search by part code, name, category"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={brandId}
                onChange={(e) => {
                  const next = e.target.value
                  setBrandId(next)
                  setModelId('')
                  setYear('')
                }}
                className="min-w-[150px] rounded-xl border border-[#d8dce3] bg-white px-3 py-3 font-sans text-sm text-[#1a1d24] outline-none focus:border-[#f15a24] focus:ring-2 focus:ring-[#f15a24]/20"
              >
                <option value="">All brands</option>
                {brandOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="inline-flex h-[46px] items-center gap-2 rounded-xl border border-steel/70 px-3 text-sm font-semibold text-fog transition-colors hover:border-accent/40 hover:text-accent lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </button>
            </div>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeChip(chip.key)}
                  className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-muted px-3 py-1 text-xs text-accent"
                >
                  {chip.label}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-full border border-steel/70 px-3 py-1 text-xs text-mist hover:border-accent/40 hover:text-accent"
              >
                Clear all
              </button>
            </div>
          ) : null}

          <header className="mb-6 rounded-2xl border border-steel/70 bg-ink/80 p-5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.22)] backdrop-blur-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-hud">Marketplace</p>
            <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-wide text-fog sm:text-4xl">
              All parts
            </h1>
            <p className="mt-3 font-sans text-sm text-mist">
              {apiLoading && !apiError ? (
                <span className="text-mist">Loading catalog…</span>
              ) : apiError ? (
                <span className="text-flare">Catalog API unavailable</span>
              ) : (
                <>
                  <span className="text-accent">{resultCount}</span> SKUs match your filters
                </>
              )}
            </p>
          </header>

          {useApi && apiError ? (
            <ApiSectionError
              title="Catalog could not load"
              message={apiError}
              onRetry={() => setCatalogRetryKey((k) => k + 1)}
              className="mb-8"
            />
          ) : null}

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {!apiError &&
              pagedParts.map((part) => {
                const img = partDisplayImage(part)
                return (
                  <CatalogPartRow
                    key={part.id}
                    part={part}
                    img={img}
                    useApi={useApi}
                    wished={wishIds.has(part.id)}
                    onWishToggle={onWishToggle}
                    catalogReturnPath={catalogReturnPath}
                  />
                )
              })}
          </ul>

          {!apiError && hasMore && (
            <div className="mt-8 flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  if (useApi) {
                    void loadMoreApi()
                  } else {
                    setVisibleCount((v) => v + PAGE_SIZE)
                  }
                }}
                disabled={apiLoadingMore}
                className="rounded-lg border border-steel/70 bg-ink/90 px-3 py-2 font-sans text-xs font-semibold uppercase tracking-wide text-fog transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {apiLoadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          {!apiError && resultCount === 0 && !apiLoading && (
            <div className="py-16 text-center">
              <p className="font-sans text-mist">No parts match your selected filters.</p>
              {(modelId || year) ? (
                <p className="mt-2 text-xs text-mist">Try clearing model/year to broaden results.</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Cart summary */}
        <aside className="w-full shrink-0 lg:sticky lg:top-[calc(var(--nav-h)+1rem)] lg:w-72 lg:self-start xl:w-80">
          <div className="ad-store-card rounded-2xl border border-steel/70 bg-ink/95 p-5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.25)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-fog">Cart</h2>
              {itemCount > 0 && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-hud">{itemCount} pcs</span>
              )}
            </div>

            {useApi && cartLoading && lineItems.length === 0 && !cartError ? (
              <p className="mt-4 font-sans text-sm text-mist">Loading cart…</p>
            ) : null}
            {useApi && cartError ? (
              <div className="mt-4">
                <ApiSectionError
                  title="Cart could not load"
                  message={cartError}
                  onRetry={retryCart}
                  className="px-3 py-4"
                />
              </div>
            ) : null}
            {lineItems.length > 0 ? (
              <ul className="mt-4 max-h-[min(50vh,420px)] space-y-3 overflow-y-auto pr-1">
                {lineItems.map(({ part, qty, lineTotal }) => (
                  <li
                    key={part.id}
                    className="flex gap-3 border-b border-fog/10 pb-3 text-left last:border-0 last:pb-0"
                  >
                    <SafeImg
                      src={partDisplayImage(part).src}
                      alt=""
                      fw={120}
                      fh={96}
                      className="h-14 w-16 shrink-0 object-cover"
                      width={96}
                      height={72}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-display text-[11px] font-bold uppercase leading-tight text-fog">
                        {part.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-mist">
                        ×{qty} · {formatInr(part.price)} ea.
                      </p>
                      <p className="font-mono text-xs font-semibold text-accent">{formatInr(lineTotal)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : !cartLoading && !cartError ? (
              <p className="mt-4 font-sans text-sm text-mist">No parts yet — add from the grid.</p>
            ) : null}

            <div className="mt-5 border-t border-fog/10 pt-4">
              <div className="flex items-center justify-between font-mono text-sm">
                <span className="text-mist">Total</span>
                <span className="text-lg font-semibold text-accent">{formatInr(subtotal)}</span>
              </div>
              {useApi && lineItems.length > 0 ? (
                user ? (
                  <Link to="/checkout" className="mt-4 block">
                    <Button variant="primary" size="md" className="w-full" type="button">
                      Proceed to checkout
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    className="mt-4 w-full"
                    type="button"
                    onClick={() => openAuth()}
                  >
                    Sign in to checkout
                  </Button>
                )
              ) : (
                <Button variant="primary" size="md" className="mt-4 w-full" type="button" disabled>
                  Proceed to checkout
                </Button>
              )}
              <Link to="/cart" className="mt-2 block">
                <Button variant="ghost" size="md" className="w-full" type="button">
                  View full cart
                </Button>
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-[80] bg-ink/70 lg:hidden">
          <div className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto p-4">
            <CatalogFiltersPanel
              mobile
              onCloseMobile={() => setMobileFiltersOpen(false)}
              useApi={useApi}
              selectedCategories={selectedCategories}
              setSelectedCategories={onCategoriesChange}
              brandId={brandId}
              setBrandId={setBrandId}
              modelId={modelId}
              setModelId={setModelId}
              year={year}
              setYear={setYear}
              brandOptions={brandOptions}
              modelOptions={modelOptions}
              yearOptions={yearOptions}
              noModelAvailable={noModelAvailable}
              noYearAvailable={noYearAvailable}
              clearAllFilters={clearAllFilters}
              resultCount={resultCount}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CatalogFiltersPanel({
  mobile = false,
  onCloseMobile,
  useApi,
  selectedCategories,
  setSelectedCategories,
  brandId,
  setBrandId,
  modelId,
  setModelId,
  year,
  setYear,
  brandOptions,
  modelOptions,
  yearOptions,
  noModelAvailable,
  noYearAvailable,
  clearAllFilters,
  resultCount,
}) {
  return (
    <div className="ad-store-card rounded-2xl border border-[#d8dce3] bg-white/95 p-5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-fog">Filters</h2>
        {mobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-steel/60 text-mist hover:text-fog"
            aria-label="Close filters"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-mist">
        {useApi ? 'Search by SKU, brand, model, and year' : 'Local filter mode'}
      </p>

      <div className="mt-5">
        <CategoryMultiSelectDropdown
          options={PART_CATEGORY_OPTIONS}
          selected={selectedCategories}
          onChange={setSelectedCategories}
        />
      </div>

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-hud">Select brand</span>
          <select
            value={brandId}
            onChange={(e) => {
              const next = e.target.value
              setBrandId(next)
              setModelId('')
              setYear('')
            }}
            className="w-full cursor-pointer rounded-xl border border-[#d8dce3] bg-white px-3 py-3 font-sans text-sm text-[#1a1d24] outline-none focus:border-[#f15a24] focus:ring-2 focus:ring-[#f15a24]/20"
          >
            <option value="">All brands</option>
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-hud">Select model</span>
          <select
            value={modelId}
            onChange={(e) => {
              setModelId(e.target.value)
              setYear('')
            }}
            disabled={!brandId}
            className="w-full cursor-pointer rounded-xl border border-[#d8dce3] bg-white px-3 py-3 font-sans text-sm text-[#1a1d24] outline-none disabled:cursor-not-allowed disabled:bg-slate/60 disabled:text-mist focus:border-[#f15a24] focus:ring-2 focus:ring-[#f15a24]/20"
          >
            <option value="">{brandId ? 'All models' : 'Select brand first'}</option>
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName ?? m.name}
              </option>
            ))}
          </select>
          {noModelAvailable ? <p className="mt-1 text-xs text-mist">No models available for this brand.</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-hud">Select year</span>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={!modelId}
            className="w-full cursor-pointer rounded-xl border border-[#d8dce3] bg-white px-3 py-3 font-sans text-sm text-[#1a1d24] outline-none disabled:cursor-not-allowed disabled:bg-slate/60 disabled:text-mist focus:border-[#f15a24] focus:ring-2 focus:ring-[#f15a24]/20"
          >
            <option value="">{modelId ? 'All years' : 'Select model first'}</option>
            {yearOptions.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
          {noYearAvailable ? <p className="mt-1 text-xs text-mist">No year options available.</p> : null}
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={clearAllFilters}
          className="rounded-lg border border-steel/70 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-mist hover:border-accent/40 hover:text-accent"
        >
          Clear all
        </button>
        <span className="text-xs text-mist">{resultCount} results</span>
      </div>
    </div>
  )
}

function CategoryMultiSelectDropdown({ options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const label = selected.length === 0 ? 'All categories' : `${selected.length} selected`
  const selectable = options.filter((c) => c !== 'All categories')

  function toggle(option) {
    if (option === 'All categories') {
      onChange([])
      setOpen(false)
      return
    }
    if (selected.includes(option)) onChange(selected.filter((x) => x !== option))
    else onChange([...selected, option])
    setOpen(false)
  }

  return (
    <div className="relative">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-hud">Categories (multi-select)</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-[#d8dce3] bg-white px-3 py-3 text-left font-sans text-sm text-[#1a1d24]"
      >
        <span>{label}</span>
        <ChevronDown className={`h-4 w-4 text-mist transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-[#d8dce3] bg-white p-2">
          <button
            type="button"
            onClick={() => {
              onChange([])
              setOpen(false)
            }}
            className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-fog hover:bg-slate/60"
          >
            <span>All categories</span>
            {selected.length === 0 ? <Check className="h-4 w-4 text-accent" /> : null}
          </button>
          {selectable.map((c) => {
            const checked = selected.includes(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-fog hover:bg-slate/60"
              >
                <span>{c}</span>
                {checked ? <Check className="h-4 w-4 text-accent" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function CatalogPartRow({ part, img, useApi, wished, onWishToggle, catalogReturnPath }) {
  const { getQty } = useCart()
  const inCart = getQty(part.id)
  const left = Math.max(0, part.totalStock - inCart)
  const canAdd = left > 0
  const detailPath = `/catalog/products/${encodeURIComponent(part.id)}`
  const detailState = { from: catalogReturnPath }

  return (
    <li className="ad-store-card group overflow-hidden rounded-xl border border-steel/70 bg-ink/95 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_-16px_rgba(0,51,102,0.18)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate">
        <Link
          to={detailPath}
          state={detailState}
          className="block h-full w-full"
          aria-label={`View details for ${part.name}`}
        >
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
        </Link>
        {useApi ? (
          <button
            type="button"
            className="absolute right-3 top-3 z-[1] flex h-9 w-9 items-center justify-center rounded-full border border-steel/80 bg-ink/90 text-mist shadow-md backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"
            aria-label={wished ? 'Remove from favorites' : 'Add to favorites'}
            onClick={(e) => onWishToggle(e, part.id)}
          >
            <Heart className={`h-4 w-4 ${wished ? 'fill-accent text-accent' : ''}`} strokeWidth={1.75} />
          </button>
        ) : null}
        <span className="part-card-category-pill pointer-events-none absolute left-3 top-3 rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-wider">
          {part.category}
        </span>
      </div>
      <div className="flex flex-col p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-hud">{part.sku}</p>
        <Link
          to={detailPath}
          state={detailState}
          className="mt-1 font-display text-base font-bold uppercase leading-snug text-fog transition-colors hover:text-accent"
        >
          {part.name}
        </Link>
        <p className="mt-2 font-display text-xl font-black text-accent">{formatInr(part.price)}</p>

        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-mist">
          <span className="font-semibold text-hud">Fits: </span>
          {part.compatibleCars.join(', ')}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 min-[420px]:gap-3">
          <CartQtyStepperOrAdd
            partId={part.id}
            maxStock={part.totalStock}
            canAdd={canAdd}
            pairedCardLayout
          />
          <Link to={detailPath} state={detailState} className={PART_CARD_DETAILS_PILL}>
            View details
          </Link>
        </div>
      </div>
    </li>
  )
}
