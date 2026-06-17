import * as adminService from '../services/adminService.js'
import { PART_IMAGES } from '../content/partImages.js'
import { getPartImage } from '../data/partsCatalog.js'
import { resolveApiAssetUrl } from './resolveApiAssetUrl.js'
import { ADMIN_LOW_STOCK_THRESHOLD, isAdminInStock, isAdminLowStock } from './adminProductStock.js'

/**
 * @param {...unknown} candidates
 * @returns {string | null}
 */
function pickUrl(...candidates) {
  for (const c of candidates) {
    if (c == null) continue
    const s = String(c).trim()
    if (s) return s
  }
  return null
}

/**
 * @param {unknown} md
 * @returns {string | null}
 */
function metadataImageUrl(md) {
  if (!md || typeof md !== 'object') return null
  return pickUrl(
    md.primaryImageUrl,
    md.image,
    md.imageUrl,
    md.primaryImage,
  )
}

/**
 * @param {unknown} gallery
 * @returns {string | null}
 */
function galleryFirstSrc(gallery) {
  if (!Array.isArray(gallery) || gallery.length === 0) return null
  const first = gallery[0]
  if (first && typeof first === 'object' && first.src) return String(first.src).trim()
  if (typeof first === 'string') return first.trim()
  return null
}

/**
 * @param {unknown} spec
 * @returns {string | null}
 */
function vehicleSpecImageUrl(spec) {
  if (!spec || typeof spec !== 'object') return null
  return pickUrl(spec.primaryImageUrl, spec.image, spec.imageUrl)
}

/**
 * Resolve best thumbnail for admin product list (uploaded URL, gallery, metadata, then catalog imageKey).
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {{ src: string, alt: string } | null}
 */
export function resolveAdminProductThumbnail(product) {
  if (!product) return null

  const md = product.metadata
  const mdGallery = md && typeof md === 'object' ? md.gallery ?? md.images : null

  const direct = pickUrl(
    product.image,
    product.imageUrl,
    product.primaryImage,
    product.primaryImageUrl,
    metadataImageUrl(md),
    galleryFirstSrc(product.gallery),
    galleryFirstSrc(mdGallery),
    vehicleSpecImageUrl(product.vehicleSpec),
  )

  if (direct) {
    return {
      src: direct,
      alt: String(product.imageAlt || product.name || product.sku || 'Product'),
    }
  }

  const key = product.imageKey
  if (key && typeof key === 'string') {
    const block = PART_IMAGES[key] || getPartImage(key)
    if (block?.src) {
      return {
        src: block.src,
        alt: block.alt || String(product.name || product.sku || 'Product'),
      }
    }
  }

  return null
}

/**
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {string | null} URL suitable for <img src>
 */
export function productListDisplayImageUrl(product) {
  const thumb = resolveAdminProductThumbnail(product)
  if (!thumb?.src) return null
  const s = thumb.src.trim()
  if (s.startsWith('data:') || s.startsWith('blob:')) return s
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('/images/')) return s
  return resolveApiAssetUrl(s) ?? s
}

/**
 * @deprecated Prefer productListDisplayImageUrl — kept for callers that only need raw path.
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {string | null}
 */
export function productListImageSrc(product) {
  return resolveAdminProductThumbnail(product)?.src ?? null
}

/**
 * @param {Record<string, unknown> | null | undefined} product
 * @param {number} threshold
 */
export function productStockStatus(product, threshold) {
  const stock = Math.max(0, Math.floor(Number(product?.totalStock ?? 0)))
  if (stock <= 0) return { key: 'out', label: 'Out of Stock' }
  if (isAdminLowStock(product, threshold)) return { key: 'low', label: 'Low Stock' }
  return { key: 'in', label: 'In Stock' }
}

/**
 * @param {number} stock
 * @param {number} threshold
 */
export function stockProgressPercent(stock, threshold) {
  const qty = Math.max(0, Math.floor(Number(stock) || 0))
  const cap = Math.max(Number(threshold) * 4, 20)
  return Math.min(100, Math.round((qty / cap) * 100))
}

/**
 * Bar color class for stock level indicator.
 * @param {Record<string, unknown>} product
 * @param {number} threshold
 */
export function stockBarColorClass(product, threshold) {
  const stock = Math.max(0, Math.floor(Number(product?.totalStock ?? 0)))
  if (stock <= 0) return 'bg-steel/50'
  if (isAdminLowStock(product, threshold)) return 'bg-flare'
  if (isAdminInStock(product, threshold)) return 'bg-emerald-500'
  if (stock <= threshold * 2) return 'bg-amber-500'
  return 'bg-emerald-500'
}

/**
 * Paginates admin product list (no search/filter) to compute catalog-wide inventory KPIs.
 * @returns {Promise<{ inventoryValue: number, outOfStockCount: number }>}
 */
export async function aggregateProductInventoryStats() {
  let page = 0
  let hasMore = true
  let inventoryValue = 0
  let outOfStockCount = 0

  while (hasMore) {
    const result = await adminService.listProductsPage({
      page,
      pageSize: 48,
      sort: 'created_desc',
      lowStockOnly: false,
    })
    for (const p of result.items || []) {
      if (p?.deleted || p?.deletedAt) continue
      const stock = Math.max(0, Math.floor(Number(p.totalStock ?? 0)))
      if (stock <= 0) outOfStockCount += 1
      const purchase = Number(p.purchasePrice ?? 0)
      if (Number.isFinite(purchase) && purchase >= 0) {
        inventoryValue += purchase * stock
      }
    }
    hasMore = Boolean(result.hasMore)
    page = Number.isFinite(result.nextPage) ? result.nextPage : page + 1
  }

  return { inventoryValue, outOfStockCount }
}

function escapeCsvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/**
 * Fetch all admin products (paginated) and download as CSV.
 * @param {{ sort?: string }} [opts]
 */
export async function exportAllProductsToCsv(opts = {}) {
  const sort = opts.sort || 'created_desc'
  const rows = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const result = await adminService.listProductsPage({
      page,
      pageSize: 48,
      sort,
      lowStockOnly: false,
    })
    for (const p of result.items || []) {
      if (p?.deleted || p?.deletedAt) continue
      rows.push(p)
    }
    hasMore = Boolean(result.hasMore)
    page = Number.isFinite(result.nextPage) ? result.nextPage : page + 1
  }

  const headers = [
    'ID',
    'SKU',
    'Name',
    'Category',
    'Price',
    'Purchase Price',
    'Stock',
    'Status',
    'Published',
    'Created',
  ]
  const lines = [
    headers.join(','),
    ...rows.map((p) => {
      const stock = Math.max(0, Math.floor(Number(p.totalStock ?? 0)))
      const status =
        stock <= 0
          ? 'out_of_stock'
          : isAdminLowStock(p, ADMIN_LOW_STOCK_THRESHOLD)
            ? 'low_stock'
            : 'in_stock'
      return [
        p.id,
        p.sku,
        p.name,
        p.category,
        p.actualPrice ?? p.price,
        p.purchasePrice,
        stock,
        status,
        p.published ? 'yes' : 'no',
        p.createdAt || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    }),
  ]

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  return rows.length
}
