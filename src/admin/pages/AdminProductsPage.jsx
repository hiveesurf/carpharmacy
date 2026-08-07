import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Download,
  Eye,
  FileSpreadsheet,
  IndianRupee,
  LayoutGrid,
  LayoutList,
  MoreVertical,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { AddStockModal } from '../components/AddStockModal.jsx'
import { AdminStatCard } from '../components/AdminStatCard.jsx'
import { ADMIN_LOW_STOCK_THRESHOLD, isAdminLowStock } from '../../lib/adminProductStock.js'
import {
  aggregateProductInventoryStats,
  exportAllProductsToCsv,
  productListDisplayImageUrl,
  productStockStatus,
  stockBarColorClass,
  stockProgressPercent,
} from '../../lib/adminProductListStats.js'
import { BulkImportProductsPanel } from '../components/BulkImportProductsPanel.jsx'
import { ProductEditDrawer } from '../components/ProductEditDrawer.jsx'
import { SaveSuccessNotice } from '../components/SaveSuccessNotice.jsx'
import * as adminService from '../../services/adminService.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import { useAuth } from '../../context/useAuth.js'

function formatInr(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

function clipDescription(text, max = 140) {
  if (!text || typeof text !== 'string') return ''
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

const PAGE_SIZE = 5
const SEARCH_DEBOUNCE_MS = 300
const ACTIONS_MENU_GAP = 6
const ACTIONS_MENU_EST_HEIGHT = 168
const ACTIONS_MENU_MIN_WIDTH = 168

const productActionTriggerClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-mist transition-colors hover:border-steel/60 hover:bg-steel/30'

const productActionMenuItemClass =
  'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-fog hover:bg-steel/30 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Three-dot actions menu for a product row (portal avoids table overflow clipping).
 */
function ProductRowActions({
  product,
  open,
  onOpenChange,
  disabled,
  onAddStock,
  onEdit,
  onView,
  onDelete,
}) {
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const [menuPos, setMenuPos] = useState(null)
  const label = product?.name || product?.sku || 'product'

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? ACTIONS_MENU_EST_HEIGHT
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < menuHeight + ACTIONS_MENU_GAP + 12
    const top = openUpward ? rect.top - menuHeight - ACTIONS_MENU_GAP : rect.bottom + ACTIONS_MENU_GAP
    const right = Math.max(8, window.innerWidth - rect.right)
    setMenuPos({ top, right })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
    const raf = requestAnimationFrame(updateMenuPosition)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(ev) {
      const target = ev.target
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      onOpenChange(false)
    }
    function onKeyDown(ev) {
      if (ev.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: menuPos?.top ?? -9999,
              right: menuPos?.right ?? 8,
              minWidth: ACTIONS_MENU_MIN_WIDTH,
              zIndex: 200,
              visibility: menuPos ? 'visible' : 'hidden',
            }}
            className="overflow-hidden rounded-lg border border-steel/60 bg-slate py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className={productActionMenuItemClass}
              onClick={() => {
                onOpenChange(false)
                onAddStock(product)
              }}
            >
              <PackagePlus className="h-4 w-4 shrink-0 text-mist" aria-hidden />
              Add Stock
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className={productActionMenuItemClass}
              onClick={() => {
                onOpenChange(false)
                onEdit(product)
              }}
            >
              <Pencil className="h-4 w-4 shrink-0 text-mist" aria-hidden />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className={productActionMenuItemClass}
              onClick={() => {
                onOpenChange(false)
                onView(product)
              }}
            >
              <Eye className="h-4 w-4 shrink-0 text-mist" aria-hidden />
              View
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className={`${productActionMenuItemClass} text-flare hover:bg-flare-muted/30`}
              onClick={() => {
                onOpenChange(false)
                onDelete(product)
              }}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              Delete
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onOpenChange(!open)
        }}
        className={`${productActionTriggerClass} ${open ? 'border-steel/60 bg-steel/30' : ''}`}
        aria-label={`Actions for ${label}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {menu}
    </>
  )
}

const compactSearchClass =
  'h-9 w-full min-w-0 flex-1 rounded-xl border border-steel/80 bg-ink/40 py-1.5 pl-8 pr-2.5 text-xs text-fog placeholder:text-mist focus:border-accent/50 focus:outline-none'

const statusBadgeClass = {
  in: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  low: 'border-flare/40 bg-flare-muted text-flare',
  out: 'border-steel/60 bg-steel/25 text-mist',
}

const categoryBadgePalettes = [
  'border-accent/35 bg-accent/10 text-accent',
  'border-hud/35 bg-hud/10 text-hud',
  'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
]

function categoryBadgeClass(category) {
  if (!category) return categoryBadgePalettes[0]
  let h = 0
  for (let i = 0; i < category.length; i += 1) h = (h + category.charCodeAt(i)) % categoryBadgePalettes.length
  return categoryBadgePalettes[h]
}

const headerBtnSecondary =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-steel/80 bg-ink/30 px-4 font-mono text-[10px] font-medium uppercase tracking-wider text-fog transition-colors hover:border-accent/50 hover:bg-accent/5 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50'

function ProductThumb({ product, className = 'h-14 w-14 shrink-0' }) {
  const [broken, setBroken] = useState(false)
  const src = productListDisplayImageUrl(product)
  const alt = product?.name || product?.sku || 'Product'

  if (!src || broken) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-xl border border-steel/50 bg-ink/30`}
        aria-hidden
      >
        <Package className="h-5 w-5 text-mist/70" strokeWidth={1.5} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      width={56}
      height={56}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={`${className} rounded-xl border border-steel/40 object-cover bg-ink/20`}
    />
  )
}

function ProductCardHero({ product }) {
  const [broken, setBroken] = useState(false)
  const src = productListDisplayImageUrl(product)
  const alt = product?.name || product?.sku || 'Product'

  if (!src || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-steel/20 px-4 text-center">
        <Package className="h-10 w-10 text-mist/50" strokeWidth={1.25} aria-hidden />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover"
    />
  )
}

function ProductStockBadge({ product, threshold }) {
  const status = productStockStatus(product, threshold)
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${statusBadgeClass[status.key]}`}
    >
      {status.label}
    </span>
  )
}

export function AdminProductsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { sessionRole } = useAuth()
  const canEditProducts = sessionRole === 'super_admin' || sessionRole === 'sales'
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [productSaveSuccess, setProductSaveSuccess] = useState(false)
  const [sort, setSort] = useState('created_desc')
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextPage, setNextPage] = useState(1)
  const [viewMode, setViewMode] = useState('list')
  const [openActionsProductId, setOpenActionsProductId] = useState(null)
  const [listRefresh, setListRefresh] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(() => searchParams.get('lowStock') === '1')
  const [lowStockCount, setLowStockCount] = useState(0)
  const [lowStockThreshold, setLowStockThreshold] = useState(ADMIN_LOW_STOCK_THRESHOLD)
  const [stockModalProduct, setStockModalProduct] = useState(null)
  const [listTotal, setListTotal] = useState(0)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [inventoryStats, setInventoryStats] = useState({ inventoryValue: 0, outOfStockCount: 0 })
  const [inventoryStatsLoading, setInventoryStatsLoading] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLowStockOnly(searchParams.get('lowStock') === '1')
  }, [searchParams])

  useEffect(() => {
    const state = location.state
    if (state?.success) {
      setProductSaveSuccess(true)
      setListRefresh((n) => n + 1)
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, location.search, navigate])

  useEffect(() => {
    let c = false
    adminService
      .listCategories()
      .then((list) => {
        if (!c) setCategories(list)
      })
      .catch(() => {
        if (!c) setCategories([])
      })
    return () => {
      c = true
    }
  }, [])

  function mergeSavedProduct(updated) {
    if (!updated?.id) return
    if (updated.deleted || updated.deletedAt) {
      setItems((prev) => prev.filter((x) => x.id !== updated.id))
      return
    }
    setItems((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
  }

  const load = useCallback(async (reset = true) => {
    setLoading(true)
    setError(null)
    try {
      const result = await adminService.listProductsPage({
        page: reset ? 0 : nextPage,
        pageSize: PAGE_SIZE,
        sort,
        search: debouncedSearch || undefined,
        lowStockOnly,
      })
      setLowStockCount(result.lowStockCount ?? 0)
      setLowStockThreshold(result.lowStockThreshold ?? ADMIN_LOW_STOCK_THRESHOLD)
      setListTotal(typeof result.total === 'number' ? result.total : 0)
      const activeItems = (result.items || []).filter((x) => !x?.deleted && !x?.deletedAt)
      if (reset) {
        setItems(activeItems)
      } else {
        setItems((prev) => [...prev, ...activeItems])
      }
      setHasMore(Boolean(result.hasMore))
      setNextPage(result.nextPage)
    } catch (e) {
      setError(getFetchErrorMessage(e))
      if (reset) setItems([])
      setHasMore(false)
      setNextPage(1)
    } finally {
      setLoading(false)
    }
  }, [nextPage, sort, listRefresh, debouncedSearch, lowStockOnly])

  function setLowStockFilter(next) {
    setLowStockOnly(next)
    setNextPage(1)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next) p.set('lowStock', '1')
        else p.delete('lowStock')
        return p
      },
      { replace: true },
    )
  }

  useEffect(() => {
    load(true)
  }, [load])

  useEffect(() => {
    let cancelled = false
    setInventoryStatsLoading(true)
    aggregateProductInventoryStats()
      .then((stats) => {
        if (!cancelled) setInventoryStats(stats)
      })
      .catch(() => {
        if (!cancelled) setInventoryStats({ inventoryValue: 0, outOfStockCount: 0 })
      })
      .finally(() => {
        if (!cancelled) setInventoryStatsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [listRefresh])

  function bumpList() {
    setListRefresh((n) => n + 1)
  }

  async function remove(p) {
    if (p.deleted) return
    if (!window.confirm(`Delete product “${p.name}” (${p.id})?`)) return
    setBusyId(p.id)
    try {
      await adminService.removeProduct(p.id)
      bumpList()
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  function onStockUpdated(updated) {
    mergeSavedProduct(updated)
    bumpList()
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      await load(false)
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleExportCsv() {
    if (exportBusy) return
    setExportBusy(true)
    setError(null)
    try {
      await exportAllProductsToCsv({ sort })
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {!canEditProducts ? (
        <div className="rounded-xl border border-steel/50 bg-slate/40 px-4 py-5 text-sm text-mist">
          Your role does not have access to product management.
        </div>
      ) : null}
      {canEditProducts ? (
      <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-fog md:text-3xl">
            Inventory
          </h1>
          <p className="mt-1 max-w-xl text-sm text-mist">
            Manage pricing, stock, vehicle fitment, and profitability by product.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => void handleExportCsv()}
            disabled={exportBusy || loading}
            className={headerBtnSecondary}
          >
            <Download className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {exportBusy ? 'Exporting…' : 'Export'}
          </button>
          <button
            type="button"
            onClick={() => setBulkImportOpen(true)}
            className={headerBtnSecondary}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
            Import Excel
          </button>
          <Link
            to="/admin/products/add"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-display text-sm font-bold uppercase tracking-wide text-on-accent shadow-md transition-[filter] hover:brightness-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add inventory
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Total products"
          value={listTotal}
          icon={Package}
          accent="text-accent"
          helper="Active catalog count"
        />
        <AdminStatCard
          label="Low stock"
          value={lowStockCount}
          icon={AlertTriangle}
          accent="text-flare"
          tone="joined"
          helper={`At or below ${lowStockThreshold} units`}
        />
        <AdminStatCard
          label="Out of stock"
          value={inventoryStatsLoading ? '…' : inventoryStats.outOfStockCount}
          icon={Package}
          accent="text-mist"
          tone="offline"
          helper="Zero units on hand"
        />
        <AdminStatCard
          label="Inventory value"
          value={inventoryStatsLoading ? '…' : formatInr(inventoryStats.inventoryValue)}
          icon={IndianRupee}
          accent="text-hud"
          tone="online"
          helper="Purchase cost × stock"
        />
      </div>

      <div className="admin-card flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, SKU, brand..."
            aria-label="Search products"
            className={compactSearchClass}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-steel/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-lg p-2 transition-colors ${
                viewMode === 'list' ? 'bg-accent/15 text-accent' : 'text-mist hover:text-fog'
              }`}
              title="List view"
              aria-pressed={viewMode === 'list'}
            >
              <LayoutList className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`rounded-lg p-2 transition-colors ${
                viewMode === 'card' ? 'bg-accent/15 text-accent' : 'text-mist hover:text-fog'
              }`}
              title="Card view"
              aria-pressed={viewMode === 'card'}
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setLowStockFilter(!lowStockOnly)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              lowStockOnly
                ? 'border-flare/50 bg-flare-muted text-flare'
                : 'border-steel/80 text-mist hover:border-flare/40 hover:text-flare'
            }`}
            aria-pressed={lowStockOnly}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            Low stock
            {lowStockCount > 0 ? (
              <span className="rounded-full bg-flare/20 px-1.5 py-0.5 tabular-nums">{lowStockCount}</span>
            ) : null}
          </button>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setNextPage(1)
              bumpList()
            }}
            className="h-9 rounded-xl border border-steel/80 bg-ink/40 px-3 font-mono text-[10px] uppercase tracking-wider text-fog focus:border-accent/50 focus:outline-none"
            aria-label="Sort products"
          >
            <option value="created_desc">Newest created</option>
            <option value="updated_desc">Recently updated</option>
          </select>
          <button
            type="button"
            onClick={() => bumpList()}
            disabled={loading || loadingMore}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-steel/80 px-3 font-mono text-[10px] uppercase tracking-wider text-mist transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            Refresh
          </button>
        </div>
      </div>

      {bulkImportOpen ? (
        <BulkImportProductsPanel
          embedded
          open
          onClose={() => setBulkImportOpen(false)}
          onCompleted={() => {
            bumpList()
            setBulkImportOpen(false)
          }}
        />
      ) : null}

      {lowStockCount > 0 ? (
        <div
          className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
            lowStockOnly ? 'border-flare/50 bg-flare-muted/80' : 'border-flare/35 bg-flare-muted/50'
          }`}
          role="status"
        >
          <p className="flex items-start gap-2 text-sm text-fog">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-flare" strokeWidth={1.75} aria-hidden />
            <span>
              <span className="font-medium text-flare">Low stock:</span>{' '}
              {lowStockCount} product{lowStockCount === 1 ? '' : 's'} at or below {lowStockThreshold} units in
              inventory.
            </span>
          </p>
          {!lowStockOnly ? (
            <button
              type="button"
              onClick={() => setLowStockFilter(true)}
              className="shrink-0 self-start rounded-lg border border-flare/40 bg-ink/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-flare transition-colors hover:bg-flare-muted sm:self-center"
            >
              View low stock
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLowStockFilter(false)}
              className="shrink-0 self-start rounded-lg border border-steel/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-mist transition-colors hover:border-accent/50 hover:text-accent sm:self-center"
            >
              Show all products
            </button>
          )}
        </div>
      ) : null}

      {debouncedSearch ? (
        <p className="font-mono text-[10px] uppercase tracking-wider text-mist">
          Showing {items.length} match{items.length === 1 ? '' : 'es'} for &ldquo;{debouncedSearch}&rdquo;
        </p>
      ) : null}

      {lowStockOnly && !debouncedSearch ? (
        <p className="font-mono text-[10px] uppercase tracking-wider text-mist">
          Filter: low stock only (≤ {lowStockThreshold} units)
        </p>
      ) : null}

      {error && (
        <div className="rounded-xl border border-flare/40 bg-flare-muted px-4 py-3 text-sm text-fog">
          {error}
        </div>
      )}

      {editingId && (
        <ProductEditDrawer
          productId={editingId}
          categories={categories}
          onClose={() => setEditingId(null)}
          onSaved={(updated, opts) => {
            mergeSavedProduct(updated)
            if (opts?.formSave) setProductSaveSuccess(true)
          }}
        />
      )}

      <SaveSuccessNotice open={productSaveSuccess} onDismiss={() => setProductSaveSuccess(false)} />

      {stockModalProduct ? (
        <AddStockModal
          product={stockModalProduct}
          onClose={() => setStockModalProduct(null)}
          onUpdated={onStockUpdated}
        />
      ) : null}

      {loading ? (
        <p className="font-mono text-xs text-mist">Loading products…</p>
      ) : viewMode === 'list' ? (
        <>
          <div className="admin-card overflow-visible rounded-2xl">
            <div className="overflow-visible pb-1">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b border-steel/50 bg-ink/20 font-mono text-[10px] uppercase tracking-wider text-mist">
                    <th className="w-[38%] px-4 py-3 font-medium">Product</th>
                    <th className="w-[14%] px-3 py-3 font-medium">Category</th>
                    <th className="w-[12%] px-3 py-3 font-medium text-right">Price</th>
                    <th className="w-[16%] px-3 py-3 font-medium">Stock</th>
                    <th className="w-[12%] px-3 py-3 font-medium">Status</th>
                    <th className="w-[8%] px-3 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-steel/40">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-mist">
                        {debouncedSearch
                          ? 'No products match your search — try another term or clear search.'
                          : lowStockOnly
                            ? 'No low-stock products — inventory looks healthy for this threshold.'
                            : 'No products on this page — add one above or go to another page.'}
                      </td>
                    </tr>
                  )}
                  {items.map((p) => {
                    const stock = Math.max(0, Math.floor(Number(p.totalStock ?? 0)))
                    const progress = stockProgressPercent(stock, lowStockThreshold)
                    return (
                      <tr
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditingId(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setEditingId(p.id)
                          }
                        }}
                        className={`cursor-pointer text-mist transition-colors hover:bg-steel/20 ${p.deleted ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <ProductThumb product={p} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-fog">{p.name}</p>
                              <p className="truncate font-mono text-[11px] text-mist">{p.sku ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {p.category ? (
                            <span
                              className={`inline-block max-w-full truncate rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${categoryBadgeClass(p.category)}`}
                            >
                              {p.category}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-display text-sm font-semibold tabular-nums text-fog">
                          {formatInr(p.actualPrice ?? p.price)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={`font-display text-sm font-bold tabular-nums ${
                                isAdminLowStock(p, lowStockThreshold) ? 'text-flare' : 'text-fog'
                              }`}
                            >
                              {stock}
                            </span>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-steel/30">
                              <div
                                className={`h-full rounded-full transition-[width] ${stockBarColorClass(p, lowStockThreshold)}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <ProductStockBadge product={p} threshold={lowStockThreshold} />
                        </td>
                        <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <ProductRowActions
                              product={p}
                              open={openActionsProductId === p.id}
                              onOpenChange={(next) => setOpenActionsProductId(next ? p.id : null)}
                              disabled={busyId === p.id || p.deleted}
                              onAddStock={(row) => setStockModalProduct(row)}
                              onEdit={(row) => setEditingId(row.id)}
                              onView={(row) => setEditingId(row.id)}
                              onDelete={(row) => remove(row)}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.length === 0 && (
              <p className="admin-card col-span-full py-12 text-center text-mist">
                {debouncedSearch
                  ? 'No products match your search — try another term or clear search.'
                  : lowStockOnly
                    ? 'No low-stock products — inventory looks healthy for this threshold.'
                    : 'No products on this page.'}
              </p>
            )}
            {items.map((p) => {
              const stock = Math.max(0, Math.floor(Number(p.totalStock ?? 0)))
              const progress = stockProgressPercent(stock, lowStockThreshold)
              return (
                <article
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditingId(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setEditingId(p.id)
                    }
                  }}
                  className="admin-card flex cursor-pointer flex-col overflow-hidden rounded-2xl text-left transition-colors hover:border-accent/35"
                >
                  <div className="relative aspect-[4/3] bg-ink/40">
                    <ProductCardHero product={p} />
                    <div className="absolute left-2 top-2">
                      <ProductStockBadge product={p} threshold={lowStockThreshold} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-mist">{p.sku}</p>
                    <h2 className="font-display text-sm font-bold uppercase leading-tight text-fog">{p.name}</h2>
                    {p.category ? (
                      <span
                        className={`inline-flex w-fit rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${categoryBadgeClass(p.category)}`}
                      >
                        {p.category}
                      </span>
                    ) : null}
                    {p.description ? (
                      <p className="line-clamp-3 text-xs leading-relaxed text-mist">
                        {clipDescription(p.description, 220)}
                      </p>
                    ) : null}
                    {p.createdAt ? (
                      <p className="font-mono text-[10px] text-mist/80">
                        {new Date(p.createdAt).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-steel/40 pt-3">
                      <div className="flex flex-col">
                        <span className="font-display text-lg font-bold tabular-nums text-accent">
                          {formatInr(p.actualPrice ?? p.price)}
                        </span>
                        <div className="mt-1 w-full">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span
                              className={`font-mono text-[10px] uppercase tracking-wider ${
                                isAdminLowStock(p, lowStockThreshold) ? 'text-flare' : 'text-mist'
                              }`}
                            >
                              Stock {stock}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-steel/30">
                            <div
                              className={`h-full rounded-full ${stockBarColorClass(p, lowStockThreshold)}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-mist">Sold {p.soldCount ?? 0}</span>
                    </div>
                    <p className={`font-mono text-[11px] ${(p.profitValue ?? 0) >= 0 ? 'text-accent' : 'text-flare'}`}>
                      P/L {formatInr(p.profitValue ?? 0)}
                    </p>
                    <div
                      className="flex justify-end border-t border-steel/40 pt-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ProductRowActions
                        product={p}
                        open={openActionsProductId === p.id}
                        onOpenChange={(next) => setOpenActionsProductId(next ? p.id : null)}
                        disabled={busyId === p.id || p.deleted}
                        onAddStock={(row) => setStockModalProduct(row)}
                        onEdit={(row) => setEditingId(row.id)}
                        onView={(row) => setEditingId(row.id)}
                        onDelete={(row) => remove(row)}
                      />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-xl border border-steel/80 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-mist transition-colors hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
      </>
      ) : null}
    </div>
  )
}
