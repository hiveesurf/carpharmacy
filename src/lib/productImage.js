import { getPartImage } from '../data/partsCatalog.js'
import { resolveApiAssetUrl } from './resolveApiAssetUrl.js'

/** @param {...unknown} candidates */
function pickUrl(...candidates) {
  for (const c of candidates) {
    if (c == null) continue
    const s = String(c).trim()
    if (s) return s
  }
  return null
}

/** @param {unknown} gallery */
export function firstGallerySrc(gallery) {
  if (!Array.isArray(gallery) || gallery.length === 0) return null
  const first = gallery[0]
  if (first && typeof first === 'object' && first.src) return String(first.src).trim()
  if (typeof first === 'string') return first.trim()
  return null
}

/**
 * Resolve storefront image URL: uploaded main → gallery → metadata → undefined.
 * @param {Record<string, unknown>} api
 */
export function resolveProductPrimaryImageUrl(api) {
  const md = api.metadata && typeof api.metadata === 'object' ? api.metadata : null
  return pickUrl(
    api.image,
    api.imageUrl,
    api.primaryImageUrl,
    md?.primaryImageUrl,
    md?.imageUrl,
    md?.image,
    firstGallerySrc(api.gallery),
    firstGallerySrc(md?.galleryExtras),
    firstGallerySrc(md?.gallery),
    firstGallerySrc(md?.images),
  )
}

/** @param {unknown} raw */
function normalizeGalleryEntry(raw, altFallback) {
  if (raw && typeof raw === 'object' && raw.src) {
    const src = resolveApiAssetUrl(String(raw.src))
    if (!src) return null
    return { src, alt: String(raw.alt || altFallback || '').trim() || altFallback }
  }
  if (typeof raw === 'string') {
    const src = resolveApiAssetUrl(raw)
    if (!src) return null
    return { src, alt: altFallback }
  }
  return null
}

/**
 * @param {Record<string, unknown>} api
 * @param {string} [altFallback]
 */
export function mapApiProductGallery(api, altFallback = '') {
  const alt = altFallback || String(api.name || api.sku || 'Product')
  const urls = []
  const primary = resolveProductPrimaryImageUrl(api)
  if (primary) {
    const src = resolveApiAssetUrl(primary)
    if (src) urls.push({ src, alt })
  }
  const galleries = [api.gallery, api.metadata?.galleryExtras, api.metadata?.gallery, api.metadata?.images]
  for (const g of galleries) {
    if (!Array.isArray(g)) continue
    for (const item of g) {
      const entry = normalizeGalleryEntry(item, alt)
      if (entry && !urls.some((u) => u.src === entry.src)) urls.push(entry)
    }
  }
  return urls
}

/**
 * @param {Record<string, unknown> | null | undefined} part
 */
export function partDisplayImage(part) {
  if (!part) return getPartImage('brakes')
  const src = resolveApiAssetUrl(part.imageUrl)
  if (src) return { src, alt: part.name || 'Part' }
  const g0 = part.galleryUrls?.[0]
  if (g0?.src) {
    const gSrc = resolveApiAssetUrl(g0.src)
    if (gSrc) return { src: gSrc, alt: g0.alt || part.name || 'Part' }
  }
  return getPartImage(part.imageKey || 'brakes')
}

/**
 * Build a normalized gallery for detail pages using the same primary rules as listing cards.
 * @param {Record<string, unknown> | null | undefined} part
 */
export function resolvePartDisplayGallery(part) {
  if (!part) return []
  /** @type {{ src: string, alt: string }[]} */
  const items = []
  const add = (rawSrc, rawAlt) => {
    const src = resolveApiAssetUrl(typeof rawSrc === 'string' ? rawSrc : '')
    if (!src) return
    if (items.some((item) => item.src === src)) return
    const alt =
      typeof rawAlt === 'string' && rawAlt.trim()
        ? rawAlt.trim()
        : String(part.name || 'Product')
    items.push({ src, alt })
  }

  const primary = partDisplayImage(part)
  if (primary?.src) add(primary.src, primary.alt)

  if (Array.isArray(part.galleryUrls)) {
    for (const g of part.galleryUrls) {
      if (g && typeof g === 'object') {
        add(g.src, g.alt)
      } else if (typeof g === 'string') {
        add(g, part.name)
      }
    }
  }

  if (Array.isArray(part.galleryKeys)) {
    for (const key of part.galleryKeys) {
      const fallback = getPartImage(key)
      if (fallback?.src) add(fallback.src, fallback.alt || part.name)
    }
  }

  return items
}
