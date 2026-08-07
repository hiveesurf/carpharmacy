/**
 * Shared PWA caching policy used by the service worker and unit tests.
 * Keep this module free of Workbox imports so Node tests can exercise it directly.
 *
 * Strategies:
 * - `bypass` — do not register a Workbox route; the browser handles the request
 *   natively (DevTools will NOT show Size: (ServiceWorker)). Used for admin,
 *   auth, orders, payments, cart, and any Authorization-bearing request.
 * - `stale-while-revalidate` / `cache-first` — public catalog + images only.
 * - `default` — no dedicated runtime strategy (precache may still apply to
 *   hashed build assets that appear in the precache manifest).
 */

/**
 * @param {string} pathname
 * @returns {string}
 */
export function normalizePathname(pathname) {
  if (!pathname) return '/'
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}

/**
 * @param {string | URL} input
 * @returns {URL}
 */
export function toUrl(input) {
  if (input instanceof URL) return input
  return new URL(String(input), 'http://pwa.local')
}

/**
 * Strip `/api/v1` (or `/api`) prefix so matchers can use resource paths.
 * @param {string} pathname
 * @returns {string} path starting with `/` relative to the API root, or the
 *   original pathname when it is not under `/api`.
 */
export function apiRelativePath(pathname) {
  const p = normalizePathname(pathname)
  if (p === '/api/v1' || p.startsWith('/api/v1/')) {
    const rest = p.slice('/api/v1'.length) || '/'
    return rest.startsWith('/') ? rest : `/${rest}`
  }
  if (p === '/api' || p.startsWith('/api/')) {
    const rest = p.slice('/api'.length) || '/'
    return rest.startsWith('/') ? rest : `/${rest}`
  }
  return p
}

/**
 * Admin / delivery app shell navigations — never use offline fallback or SPA navigation caching.
 * @param {string} pathname
 */
export function isPrivilegedAppPath(pathname) {
  const p = normalizePathname(pathname)
  return p === '/admin' || p.startsWith('/admin/') || p === '/delivery' || p.startsWith('/delivery/')
}

/**
 * True for the five endpoints called out in production Network traces (and their
 * `/api/v1/...` forms): cart, dashboard, notifications, me, refresh-token.
 * @param {string} pathname
 */
export function isNamedSensitiveEndpoint(pathname) {
  const p = normalizePathname(pathname)
  const rel = apiRelativePath(p)

  // Exact / suffix forms seen in DevTools (with or without /api/v1).
  const exact = new Set([
    '/cart',
    '/dashboard',
    '/notifications',
    '/me',
    '/refresh-token',
    '/auth/me',
    '/auth/refresh-token',
    '/auth/notifications',
    '/admin/dashboard',
    '/admin/me',
    '/admin/notifications',
  ])
  if (exact.has(p) || exact.has(rel)) return true

  if (rel === '/cart' || rel.startsWith('/cart/')) return true
  if (rel === '/dashboard' || rel.startsWith('/dashboard/')) return true
  if (rel.endsWith('/dashboard')) return true
  if (rel === '/me' || rel.endsWith('/me')) return true
  if (rel === '/refresh-token' || rel.endsWith('/refresh-token')) return true
  if (rel === '/notifications' || rel.includes('/notifications')) return true

  return false
}

/**
 * API paths that must never be handled by a Workbox runtime strategy.
 * @param {string} pathname
 */
export function isSensitiveApiPath(pathname) {
  const p = normalizePathname(pathname)
  const rel = apiRelativePath(p)

  if (isNamedSensitiveEndpoint(p)) return true

  if (rel === '/auth' || rel.startsWith('/auth/')) return true
  if (rel === '/admin' || rel.startsWith('/admin/')) return true
  if (rel === '/orders' || rel.startsWith('/orders/')) return true
  if (rel === '/payments' || rel.startsWith('/payments/')) return true
  if (rel === '/cart' || rel.startsWith('/cart/')) return true
  if (rel === '/user' || rel.startsWith('/user/')) return true
  if (rel === '/addresses' || rel.startsWith('/addresses/')) return true
  if (rel === '/wishlist' || rel.startsWith('/wishlist/')) return true
  return false
}

/**
 * Public catalog/read APIs — safe for stale-while-revalidate.
 * @param {string} pathname
 */
export function isPublicCatalogApiPath(pathname) {
  if (isSensitiveApiPath(pathname)) return false
  const rel = apiRelativePath(pathname)

  if (rel === '/products' || rel.startsWith('/products/')) return true
  if (rel === '/categories' || rel.startsWith('/categories/')) return true
  if (rel === '/cars' || rel.startsWith('/cars/')) return true
  if (rel === '/vehicle' || rel.startsWith('/vehicle/')) return true
  return false
}

/**
 * @param {Headers | Record<string, string> | null | undefined} headers
 */
export function hasAuthorizationHeader(headers) {
  if (!headers) return false
  if (typeof headers.get === 'function') {
    const v = headers.get('authorization') || headers.get('Authorization')
    return Boolean(v && String(v).trim())
  }
  const raw = headers.authorization || headers.Authorization
  return Boolean(raw && String(raw).trim())
}

/**
 * Product / static image URLs — cache-first with expiration in the SW.
 * @param {string} pathname
 * @param {string} [destination]
 */
export function isCacheableImagePath(pathname, destination = '') {
  if (destination === 'image') return true
  const p = normalizePathname(pathname).toLowerCase()
  if (p.startsWith('/images/') || p.startsWith('/icons/') || p.startsWith('/brands/') || p.startsWith('/assets/')) {
    return /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(p) || p.startsWith('/images/')
  }
  if (p === '/logo-carnalysys.png' || p.startsWith('/uploads/')) return true
  return /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(p)
}

/**
 * Decision used by the service worker route matchers.
 * @param {{ url: string | URL, method?: string, headers?: Headers | Record<string, string>, destination?: string, mode?: string }} req
 * @returns {'bypass' | 'stale-while-revalidate' | 'cache-first' | 'default'}
 */
export function resolveCacheStrategy(req) {
  const url = toUrl(req.url)
  const method = String(req.method || 'GET').toUpperCase()
  const pathname = url.pathname

  // Mutating / non-GET: never let Workbox own the request.
  if (method !== 'GET' && method !== 'HEAD') {
    return 'bypass'
  }

  // Invoked from every registerRoute matcher via this function — Authorization
  // forces bypass even when the path looks like a public catalog read.
  if (hasAuthorizationHeader(req.headers)) {
    return 'bypass'
  }

  if (isPrivilegedAppPath(pathname)) {
    return 'bypass'
  }

  if (isSensitiveApiPath(pathname)) {
    return 'bypass'
  }

  if (isPublicCatalogApiPath(pathname)) {
    return 'stale-while-revalidate'
  }

  if (isCacheableImagePath(pathname, req.destination)) {
    return 'cache-first'
  }

  return 'default'
}

/**
 * Workbox runtime strategy name, or `null` when the SW must not handle the
 * request (browser network path — no Size: (ServiceWorker) from Workbox).
 * @param {{ url: string | URL, method?: string, headers?: Headers | Record<string, string>, destination?: string, mode?: string }} req
 * @returns {'stale-while-revalidate' | 'cache-first' | null}
 */
export function workboxRuntimeStrategy(req) {
  const strategy = resolveCacheStrategy(req)
  if (strategy === 'stale-while-revalidate' || strategy === 'cache-first') {
    return strategy
  }
  return null
}

/**
 * Storefront navigations may use the offline fallback; admin/delivery must not.
 * @param {string | URL} url
 */
export function shouldOfferOfflineFallback(url) {
  const pathname = toUrl(url).pathname
  if (isPrivilegedAppPath(pathname)) return false
  if (pathname.startsWith('/api/')) return false
  return true
}
