import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  Bell,
  Heart,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  Search,
  ShoppingCart,
  Sun,
  User,
  X,
} from 'lucide-react'
import { useTheme } from '../../context/useTheme'
import { useCart } from '../../context/useCart'
import { useAuth } from '../../context/useAuth'
import { publicUrl } from '../../lib/publicUrl'
import { resolveApiAssetUrl } from '../../lib/resolveApiAssetUrl.js'
import { searchProductsQuick } from '../../services/productService.js'
import { loadWishlist } from '../../services/wishlistService.js'
import { useNotifications } from '../../context/useNotifications.js'
import {
  formatPublicIdentityInitials,
  formatPublicIdentityLabel,
} from '../../lib/identityDisplayLabel.js'

const BRAND_TEXT_ANIM_PRESETS = [
  {
    initial: { x: -56, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { type: 'spring', stiffness: 380, damping: 26, mass: 0.85 },
  },
  {
    initial: { y: -28, opacity: 0, rotate: -5 },
    animate: { y: 0, opacity: 1, rotate: 0 },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
  {
    initial: { scale: 0.72, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: 'spring', stiffness: 420, damping: 22 },
  },
  {
    initial: { x: 40, opacity: 0, skewX: 10 },
    animate: { x: 0, opacity: 1, skewX: 0 },
    transition: { duration: 0.48, ease: [0.34, 1.56, 0.64, 1] },
  },
  {
    initial: { opacity: 0, filter: 'blur(10px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
  {
    initial: { opacity: 0, letterSpacing: '0.35em' },
    animate: { opacity: 1, letterSpacing: '0.02em' },
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
  {
    initial: { y: 18, opacity: 0, scale: 1.12 },
    animate: { y: 0, opacity: 1, scale: 1 },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  {
    initial: { rotate: -12, opacity: 0, scale: 0.9 },
    animate: { rotate: 0, opacity: 1, scale: 1 },
    transition: { type: 'spring', stiffness: 300, damping: 18 },
  },
]

export function Navbar() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const { theme, toggleTheme } = useTheme()
  const { itemCount, openCart } = useCart()
  const { user, isAdmin, signOut, openAuth, authHydrated, sessionRole } = useAuth()
  const adminButtonLabel =
    sessionRole === 'delivery' || user?.role === 'delivery' ? 'Delivery' : 'Admin'
  const identityLabel = user ? formatPublicIdentityLabel(user, sessionRole) : ''
  const identityInitials = user ? formatPublicIdentityInitials(user, sessionRole) : '?'

  const {
    items: notifications,
    unreadCount,
    panelOpen: notificationsOpen,
    setPanelOpen: setNotificationsOpen,
    markAllRead,
    enablePushNotifications,
    loading: notificationsLoading,
    markReadByIds,
  } = useNotifications()
  const [avatarBroken, setAvatarBroken] = useState(false)
  const resolvedNavAvatar =
    user?.avatarUrl && typeof user.avatarUrl === 'string'
      ? resolveApiAssetUrl(user.avatarUrl)
      : undefined

  useEffect(() => {
    setAvatarBroken(false)
  }, [user?.avatarUrl])

  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef(null)
  const notificationRef = useRef(null)

  useEffect(() => {
    if (!accountMenuOpen) return
    const onDoc = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [accountMenuOpen])

  useEffect(() => {
    if (!notificationsOpen) return undefined
    function onPointerDown(ev) {
      if (notificationRef.current?.contains(ev.target)) return
      setNotificationsOpen(false)
    }
    function onKeyDown(ev) {
      if (ev.key === 'Escape') setNotificationsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [notificationsOpen, setNotificationsOpen])

  const [brandTextAnim] = useState(
    () => BRAND_TEXT_ANIM_PRESETS[Math.floor(Math.random() * BRAND_TEXT_ANIM_PRESETS.length)],
  )

  const onFavoritesClick = async () => {
    if (!user) {
      openAuth()
      return
    }
    if (!authHydrated) return
    navigate('/favorites')
    try {
      await loadWishlist()
    } catch {
      /* ignore */
    }
  }

  const onSearch = async (e) => {
    e.preventDefault()
    setOpen(false)
    const term = q.trim()
    try {
      if (term) await searchProductsQuick(term)
    } catch {
      /* still navigate */
    }
    navigate(term ? `/catalog?q=${encodeURIComponent(term)}` : '/catalog')
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="nav-chrome fixed inset-x-0 top-0 z-50 border-b border-steel/60 bg-ink/95 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] backdrop-blur-md"
    >
      <nav className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:gap-6 lg:px-10">
        <Link to="/" className="group flex shrink-0 items-center gap-2" onClick={() => setOpen(false)}>
          <img
            src={publicUrl('logo-carnalysys.png')}
            alt="carpharmacy"
            className="h-9 w-9 rounded-full border border-steel/70 object-cover sm:h-10 sm:w-10"
            loading="eager"
            decoding="async"
          />
          <motion.span
            className="inline-block origin-left font-display text-xl font-black uppercase leading-none tracking-tight text-fog sm:text-2xl"
            initial={brandTextAnim.initial}
            animate={brandTextAnim.animate}
            transition={brandTextAnim.transition}
          >
            carpharmacy
          </motion.span>
        </Link>

        <form
          onSubmit={onSearch}
          className="relative mx-auto hidden min-w-0 max-w-xl flex-1 md:flex"
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search parts, SKU, brand…"
            className="w-full rounded-full border border-steel/80 bg-slate py-2.5 pl-4 pr-14 font-sans text-sm text-fog outline-none transition-[border-color,box-shadow] placeholder:text-mist focus:border-accent focus:ring-2 focus:ring-accent/20"
            aria-label="Search catalog"
          />
          <button
            type="submit"
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent transition-[filter,transform] hover:brightness-95 active:scale-95"
            aria-label="Search"
          >
            <Search className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </form>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {!user ? (
            <button
              type="button"
              onClick={() => openAuth()}
              className="hidden h-10 items-center gap-1.5 rounded-xl border border-steel/80 px-3 font-sans text-xs font-semibold text-fog transition-colors hover:border-accent/40 md:flex"
              aria-label="Account"
            >
              <User size={18} strokeWidth={1.75} />
              <span className="hidden lg:inline">Account</span>
            </button>
          ) : null}

          {user ? (
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-steel/80 text-mist transition-colors hover:border-accent/40 hover:text-accent"
                aria-label="Notifications"
              >
                <Bell size={18} strokeWidth={1.75} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-hud px-1 font-sans text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[110] w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-steel/80 bg-ink p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-sans text-xs font-semibold uppercase tracking-wide text-fog">Notifications</p>
                    <button
                      type="button"
                      onClick={() => void markAllRead()}
                      className="font-sans text-[11px] font-semibold text-accent hover:underline"
                    >
                      Mark all read
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void enablePushNotifications()}
                    className="mb-2 rounded-lg border border-steel/70 px-2 py-1 font-sans text-[11px] text-mist transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    Enable push
                  </button>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {notificationsLoading ? (
                      <p className="text-xs text-mist">Loading…</p>
                    ) : notifications.length === 0 ? (
                      <p className="text-xs text-mist">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => {
                        const canOpenOrder =
                          n?.sourceType === 'order' ||
                          n?.topic === 'order_status' ||
                          n?.topic === 'payment'
                        return (
                          <article key={n.id} className="rounded-lg border border-steel/60 bg-slate/40 p-2.5">
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
                            {canOpenOrder && n?.sourceId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setNotificationsOpen(false)
                                  navigate(`/orders?focusOrder=${encodeURIComponent(String(n.sourceId))}`)
                                }}
                                className="mt-2 font-sans text-[11px] font-semibold text-accent hover:underline"
                              >
                                View order details
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
          ) : null}

          <button
            type="button"
            onClick={onFavoritesClick}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-steel/80 text-mist transition-colors hover:border-accent/40 hover:text-accent md:flex"
            aria-label="Favorites"
          >
            <Heart size={20} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={openCart}
            className="relative flex h-10 items-center gap-2 rounded-xl bg-accent px-3 font-sans text-xs font-bold uppercase tracking-wide text-on-accent shadow-md transition-[filter,transform] hover:brightness-95 active:scale-[0.98] sm:px-4"
            aria-label={`Cart${itemCount ? `, ${itemCount} items` : ''}`}
          >
            <ShoppingCart size={18} strokeWidth={1.75} />
            <span className="hidden sm:inline">Cart</span>
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-hud px-1 font-sans text-[10px] font-bold text-white">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-steel/80 text-mist transition-colors hover:border-accent/40 hover:text-accent"
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <div className="hidden items-center gap-2 lg:flex">
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex h-10 items-center gap-1 rounded-xl border border-accent/50 px-3 font-sans text-xs font-semibold text-accent transition-colors hover:bg-accent/10"
                  title={`${adminButtonLabel} dashboard`}
                >
                  <LayoutDashboard size={16} strokeWidth={2} />
                  {adminButtonLabel}
                </Link>
              )}
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  className="flex max-w-[200px] items-center gap-2 rounded-xl border border-steel/80 px-2 py-1.5 font-sans text-xs font-medium text-mist transition-colors hover:border-accent/40 hover:bg-slate/40 hover:text-accent"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                  onClick={() => setAccountMenuOpen((o) => !o)}
                >
                  {resolvedNavAvatar && !avatarBroken ? (
                    <img
                      src={resolvedNavAvatar}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full border border-steel/70 object-cover"
                      onError={() => setAvatarBroken(true)}
                    />
                  ) : (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-steel/70 bg-steel/25 font-sans text-[10px] font-bold uppercase tracking-tight text-fog"
                      aria-hidden
                    >
                      {identityInitials}
                    </span>
                  )}
                  <span className="min-w-0 truncate">{identityLabel}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-mist transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
                {accountMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-[calc(100%+0.35rem)] z-[100] min-w-[11rem] rounded-xl border border-steel/80 bg-ink py-1 shadow-xl backdrop-blur-md"
                  >
                    <Link
                      role="menuitem"
                      to="/account"
                      className="flex items-center gap-2 px-3 py-2.5 font-sans text-sm font-semibold text-fog transition-colors hover:bg-slate/60 hover:text-accent"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <User size={16} strokeWidth={1.75} className="shrink-0 opacity-80" aria-hidden />
                      Account
                    </Link>
                    <Link
                      role="menuitem"
                      to="/orders"
                      className="flex items-center gap-2 px-3 py-2.5 font-sans text-sm font-semibold text-fog transition-colors hover:bg-slate/60 hover:text-accent"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <Package size={16} strokeWidth={1.75} className="shrink-0 opacity-80" aria-hidden />
                      Orders
                    </Link>
                    <div className="my-1 border-t border-steel/60" aria-hidden />
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-3 py-2.5 text-left font-sans text-sm font-semibold text-mist transition-colors hover:bg-slate/60 hover:text-flare"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        signOut()
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-steel/80 text-fog md:hidden"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-steel/60 bg-ink md:hidden"
          >
            <form onSubmit={onSearch} className="flex gap-2 p-4">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search parts…"
                className="min-w-0 flex-1 rounded-xl border border-steel/80 bg-slate px-3 py-2 font-sans text-sm text-fog outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="rounded-xl bg-accent px-4 font-sans text-sm font-bold text-on-accent"
              >
                Go
              </button>
            </form>
            <ul className="flex flex-col gap-1 border-t border-steel/50 px-4 pb-4">
              {!user && (
                <li>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-steel/80 py-2.5 font-sans text-sm font-semibold text-fog"
                    onClick={() => {
                      openAuth()
                      setOpen(false)
                    }}
                  >
                    Sign in / Register
                  </button>
                </li>
              )}
              {user && (
                <li className="space-y-2 py-2 font-sans text-sm text-mist">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {resolvedNavAvatar && !avatarBroken ? (
                        <img
                          src={resolvedNavAvatar}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full border border-steel/70 object-cover"
                          onError={() => setAvatarBroken(true)}
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-steel/70 bg-steel/25 text-xs font-bold uppercase text-fog">
                          {identityInitials}
                        </span>
                      )}
                      <span className="truncate font-semibold text-fog">{identityLabel}</span>
                    </div>
                    <button type="button" className="shrink-0 text-accent" onClick={() => { signOut(); setOpen(false) }}>
                      Sign out
                    </button>
                  </div>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 rounded-xl border border-accent/40 py-2 pl-3 font-semibold text-accent"
                      onClick={() => setOpen(false)}
                    >
                      <LayoutDashboard size={16} />
                      {adminButtonLabel} dashboard
                    </Link>
                  )}
                  <Link
                    to="/orders"
                    className="flex items-center gap-2 rounded-xl border border-steel/70 py-2 pl-3 font-semibold text-fog"
                    onClick={() => setOpen(false)}
                  >
                    <Package size={16} strokeWidth={1.75} />
                    My orders
                  </Link>
                  <Link
                    to="/account"
                    className="block rounded-xl border border-steel/70 py-2 pl-3 font-semibold text-fog"
                    onClick={() => setOpen(false)}
                  >
                    Account
                  </Link>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-steel/70 py-2 pl-3 text-left font-semibold text-fog"
                    onClick={() => {
                      onFavoritesClick()
                      setOpen(false)
                    }}
                  >
                    Favorites
                  </button>
                </li>
              )}
              <li>
                <Link to="/catalog" className="block py-2 font-sans text-sm font-semibold text-hud" onClick={() => setOpen(false)}>
                  Parts catalog →
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
