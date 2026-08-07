/**
 * Install-prompt dismissal + engagement helpers (localStorage, same pattern as cart/theme).
 */

const DISMISS_KEY = 'carpharmacy-pwa-install-dismissed-at'
const NAV_COUNT_KEY = 'carpharmacy-pwa-nav-count'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const MIN_NAVIGATIONS = 2

export function isInstallPromptCoolingDown(now = Date.now()) {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return now - at < COOLDOWN_MS
  } catch {
    return false
  }
}

export function dismissInstallPrompt(now = Date.now()) {
  try {
    localStorage.setItem(DISMISS_KEY, String(now))
  } catch {
    /* ignore quota / private mode */
  }
}

export function getStorefrontNavCount() {
  try {
    const n = Number(localStorage.getItem(NAV_COUNT_KEY) || '0')
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function bumpStorefrontNavCount() {
  try {
    const next = getStorefrontNavCount() + 1
    localStorage.setItem(NAV_COUNT_KEY, String(next))
    return next
  } catch {
    return 0
  }
}

/**
 * @param {{ pathname: string, cartItemCount?: number, navCount?: number, now?: number }} opts
 */
export function shouldShowInstallPrompt(opts) {
  const pathname = String(opts.pathname || '/')
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/delivery' || pathname.startsWith('/delivery/')) {
    return false
  }
  if (isInstallPromptCoolingDown(opts.now)) return false
  const navCount = opts.navCount ?? getStorefrontNavCount()
  const cartItemCount = Number(opts.cartItemCount || 0)
  return navCount >= MIN_NAVIGATIONS || cartItemCount > 0
}

export function isIosSafariLike() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true
  return iOS && !isStandalone
}
