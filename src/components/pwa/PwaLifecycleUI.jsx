import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, RefreshCw, X } from 'lucide-react'
import { useCart } from '../../context/useCart.js'
import {
  bumpStorefrontNavCount,
  dismissInstallPrompt,
  isIosSafariLike,
  shouldShowInstallPrompt,
} from '../../lib/pwaInstallPrompt.js'

const bannerClass =
  'fixed inset-x-0 bottom-0 z-[80] mx-auto w-full max-w-lg p-3 sm:bottom-4 sm:px-4'

const cardClass =
  'flex items-start gap-3 rounded-2xl border border-steel/80 bg-ink/95 p-3 text-fog shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur'

/**
 * Storefront-only install + app-wide update prompt. Never shown as an admin feature.
 */
export function PwaLifecycleUI() {
  const location = useLocation()
  const { itemCount } = useCart()
  const cartItemCount = Number(itemCount || 0)

  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstall, setShowInstall] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })

  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/admin') || path.startsWith('/delivery')) return
    bumpStorefrontNavCount()
  }, [location.pathname])

  useEffect(() => {
    const path = location.pathname
    setShowInstall(
      shouldShowInstallPrompt({
        pathname: path,
        cartItemCount,
      }),
    )
  }, [location.pathname, cartItemCount])

  useEffect(() => {
    const onBip = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    setIosHint(isIosSafariLike())
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  const onDismissInstall = () => {
    dismissInstallPrompt()
    setShowInstall(false)
    setDeferredPrompt(null)
  }

  const onInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    try {
      await deferredPrompt.userChoice
    } catch {
      /* user dismissed native sheet */
    }
    setDeferredPrompt(null)
    dismissInstallPrompt()
    setShowInstall(false)
  }

  const privileged = location.pathname.startsWith('/admin') || location.pathname.startsWith('/delivery')
  const canShowInstallUi = !privileged && showInstall && (deferredPrompt || iosHint)

  return (
    <>
      {needRefresh ? (
        <div className={bannerClass} role="status">
          <div className={cardClass}>
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm font-semibold text-fog">New version available</p>
              <p className="mt-0.5 font-sans text-xs text-mist">Refresh to update. Unsaved checkout work may be lost.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-accent px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-on-accent"
                  onClick={() => updateServiceWorker(true)}
                >
                  Refresh to update
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-steel/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-mist"
                  onClick={() => setNeedRefresh(false)}
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!needRefresh && canShowInstallUi ? (
        <div className={bannerClass} role="dialog" aria-label="Install CarPharmacy">
          <div className={cardClass}>
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm font-semibold text-fog">Install CarPharmacy</p>
              {iosHint && !deferredPrompt ? (
                <p className="mt-0.5 font-sans text-xs text-mist">
                  On iPhone/iPad: tap Share, then &quot;Add to Home Screen&quot;.
                </p>
              ) : (
                <p className="mt-0.5 font-sans text-xs text-mist">Add the storefront to your home screen for quicker access.</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {deferredPrompt ? (
                  <button
                    type="button"
                    className="rounded-xl bg-accent px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-on-accent"
                    onClick={onInstall}
                  >
                    Install app
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-xl border border-steel/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-mist"
                  onClick={onDismissInstall}
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded-lg p-1 text-mist hover:text-fog"
              onClick={onDismissInstall}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
