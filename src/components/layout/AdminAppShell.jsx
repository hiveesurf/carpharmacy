import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { AuthModals } from '../auth/AuthModals'
import { useAuth } from '../../context/useAuth'
import { useNotifications } from '../../context/useNotifications.js'
import { formatPublicIdentityLabel } from '../../lib/identityDisplayLabel.js'
import {
  isAdminLowStockNotification,
  notificationTargetPath,
} from '../../lib/adminNotificationLinks.js'
import { postLoginPathForRole } from '../../lib/postLoginPath.js'

/**
 * Admin area only: no storefront navbar/hero/footer — full dashboard after login.
 * Chrome matches storefront navbar (nav-chrome) for a cohesive light-theme look.
 */
export function AdminAppShell({ children }) {
  const navigate = useNavigate()
  const { user, signOut, sessionRole } = useAuth()
  const headerBrand =
    sessionRole === 'delivery' ? 'carpharmacy delivery' : 'carpharmacy admin'
  const staffHomePath = postLoginPathForRole(sessionRole) ?? '/admin'
  const { unreadCount, panelOpen, setPanelOpen, items, markAllRead, markReadByIds, enablePushNotifications } =
    useNotifications()
  const notificationRef = useRef(null)

  const closeNotificationsPanel = () => setPanelOpen(false)

  useEffect(() => {
    if (!panelOpen) return undefined
    function onPointerDown(ev) {
      if (notificationRef.current?.contains(ev.target)) return
      setPanelOpen(false)
    }
    function onKeyDown(ev) {
      if (ev.key === 'Escape') setPanelOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [panelOpen, setPanelOpen])

  return (
    <div className="relative min-h-svh bg-ink text-fog antialiased">
      <header className="nav-chrome fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between gap-4 border-b border-steel/60 bg-ink/95 px-4 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] backdrop-blur-md md:px-8">
        <Link
          to={staffHomePath}
          className="font-display text-sm font-bold uppercase tracking-wider text-fog transition-colors hover:text-accent"
        >
          {headerBrand}
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-steel/80 text-mist transition-colors hover:border-accent/40 hover:text-accent"
              aria-label="Admin notifications"
              aria-expanded={panelOpen}
            >
              <Bell size={16} />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-hud px-1 font-sans text-[9px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>
            {panelOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.4rem)] z-[110] w-80 rounded-xl border border-steel/80 bg-ink p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-sans text-xs font-semibold uppercase tracking-wide text-fog">Admin alerts</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void markAllRead()}
                      className="font-sans text-[11px] font-semibold text-accent hover:underline"
                    >
                      Mark all read
                    </button>
                    <button
                      type="button"
                      onClick={closeNotificationsPanel}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-steel/70 text-mist transition-colors hover:border-accent/40 hover:text-accent"
                      aria-label="Close notifications"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void enablePushNotifications()}
                  className="mb-2 rounded-lg border border-steel/70 px-2 py-1 font-sans text-[11px] text-mist transition-colors hover:border-accent/40 hover:text-accent"
                >
                  Enable push
                </button>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-xs text-mist">No notifications yet.</p>
                  ) : (
                    items.map((n) => {
                      const targetPath = notificationTargetPath(n, sessionRole)
                      const isCritical =
                        n?.payload?.severity === 'critical' ||
                        (isAdminLowStockNotification(n) && Number(n?.payload?.currentStock ?? 1) <= 0)
                      return (
                        <article
                          key={n.id}
                          className={`rounded-lg border p-2.5 ${
                            isCritical
                              ? 'border-flare/50 bg-flare-muted/40'
                              : 'border-steel/60 bg-slate/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 text-xs font-semibold text-fog">{n.title}</p>
                            <button
                              type="button"
                              onClick={() => void markReadByIds([n.id])}
                              className="shrink-0 font-sans text-[10px] font-semibold uppercase tracking-wide text-mist transition-colors hover:text-accent"
                            >
                              Clear
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-mist">{n.body}</p>
                          {targetPath ? (
                            <button
                              type="button"
                              onClick={() => {
                                void markReadByIds([n.id])
                                closeNotificationsPanel()
                                navigate(targetPath)
                              }}
                              className="mt-2 font-sans text-[11px] font-semibold text-accent hover:underline"
                            >
                              {isAdminLowStockNotification(n) ? 'View low stock' : 'Open orders'}
                            </button>
                          ) : null}
                        </article>
                      )
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
          {user || sessionRole === 'super_admin' ? (
            <span className="hidden max-w-[240px] truncate font-sans text-xs text-mist md:inline">
              {formatPublicIdentityLabel(user, sessionRole)}
            </span>
          ) : null}
          <Link
            to="/"
            className="font-sans text-xs font-semibold uppercase tracking-wide text-accent underline-offset-2 hover:underline"
          >
            Store home
          </Link>
          <button
            type="button"
            onClick={() => void signOut().then(() => navigate('/', { replace: true }))}
            className="rounded-xl border border-steel/80 px-3 py-1.5 font-sans text-xs font-semibold text-mist transition-colors hover:border-accent/40 hover:text-accent"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="pt-14">{children}</div>
      <AuthModals />
    </div>
  )
}
