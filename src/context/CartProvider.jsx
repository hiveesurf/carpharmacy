import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartContext } from './cart-context.js'
import { PARTS_CATALOG } from '../data/partsCatalog.js'
import { apiV1Base } from '../api/client.js'
import * as cartService from '../services/cartService.js'
import { useAuth } from './useAuth.js'
import { mapApiProductToPart } from '../lib/mapApiProduct.js'
import { getFetchErrorMessage } from '../lib/apiErrorMessage.js'

const STORAGE_KEY = 'autox-cart-v1'

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {
    /* ignore */
  }
  return {}
}

function apiMode() {
  return Boolean(apiV1Base())
}

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [quantities, setQuantities] = useState(loadCart)
  const [remoteSnapshot, setRemoteSnapshot] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cartError, setCartError] = useState(null)
  const [cartLoading, setCartLoading] = useState(() => apiMode())

  /** Full load with spinner — mount, auth change, user retry. */
  const loadRemoteCartWithFeedback = useCallback(async () => {
    if (!apiMode()) return
    setCartLoading(true)
    setCartError(null)
    try {
      const data = await cartService.fetchCart()
      setRemoteSnapshot(data)
    } catch (e) {
      setCartError(getFetchErrorMessage(e))
      setRemoteSnapshot({ items: [], itemCount: 0, subtotal: 0 })
    } finally {
      setCartLoading(false)
    }
  }, [])

  /** Refresh after mutations — no global loading flash. */
  const refreshRemoteCartSilently = useCallback(async () => {
    if (!apiMode()) return
    try {
      const data = await cartService.fetchCart()
      setRemoteSnapshot(data)
      setCartError(null)
    } catch (e) {
      setCartError(getFetchErrorMessage(e))
    }
  }, [])

  useEffect(() => {
    if (!apiMode()) return
    loadRemoteCartWithFeedback()
  }, [loadRemoteCartWithFeedback, user?.phone])

  useEffect(() => {
    if (apiMode()) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quantities))
  }, [quantities])

  const retryCart = useCallback(() => {
    loadRemoteCartWithFeedback()
  }, [loadRemoteCartWithFeedback])

  const getQty = useCallback(
    (partId) => {
      if (apiMode()) {
        if (!remoteSnapshot) return 0
        const line = remoteSnapshot.items.find((i) => i.productId === partId || i.product?.id === partId)
        return line?.quantity ?? 0
      }
      return quantities[partId] ?? 0
    },
    [remoteSnapshot, quantities],
  )

  const addToCart = useCallback(
    async (partId, amount = 1) => {
      if (apiMode()) {
        try {
          await cartService.addCartLine(partId, amount)
          await refreshRemoteCartSilently()
        } catch (e) {
          setCartError(getFetchErrorMessage(e))
        }
        return
      }
      const part = PARTS_CATALOG.find((p) => p.id === partId)
      if (!part) return
      setQuantities((prev) => {
        const cur = prev[partId] ?? 0
        const next = Math.min(cur + amount, part.totalStock)
        if (next <= 0) return prev
        return { ...prev, [partId]: next }
      })
    },
    [refreshRemoteCartSilently],
  )

  const setPartQty = useCallback(
    async (partId, qty) => {
      if (apiMode()) {
        const snap = remoteSnapshot
        if (!snap) return
        const line = snap.items.find((i) => i.productId === partId || i.product?.id === partId)
        if (!line) return
        try {
          if (qty <= 0) await cartService.removeCartLine(line.id)
          else await cartService.updateCartLine(line.id, qty)
          await refreshRemoteCartSilently()
        } catch (e) {
          setCartError(getFetchErrorMessage(e))
        }
        return
      }
      const part = PARTS_CATALOG.find((p) => p.id === partId)
      if (!part) return
      setQuantities((prev) => {
        if (qty <= 0) {
          const { [partId]: _, ...rest } = prev
          return rest
        }
        return { ...prev, [partId]: Math.min(qty, part.totalStock) }
      })
    },
    [remoteSnapshot, refreshRemoteCartSilently],
  )

  const removeFromCart = useCallback(
    async (partId) => {
      if (apiMode()) {
        const snap = remoteSnapshot
        if (!snap) return
        const line = snap.items.find((i) => i.productId === partId || i.product?.id === partId)
        if (!line) return
        try {
          await cartService.removeCartLine(line.id)
          await refreshRemoteCartSilently()
        } catch (e) {
          setCartError(getFetchErrorMessage(e))
        }
        return
      }
      setQuantities((prev) => {
        const { [partId]: _, ...rest } = prev
        return rest
      })
    },
    [remoteSnapshot, refreshRemoteCartSilently],
  )

  const clearCart = useCallback(async () => {
    if (apiMode()) {
      try {
        await cartService.clearRemoteCart()
        await refreshRemoteCartSilently()
      } catch (e) {
        setCartError(getFetchErrorMessage(e))
      }
      return
    }
    setQuantities({})
  }, [refreshRemoteCartSilently])

  const replaceCartWith = useCallback(
    async (partId, amount = 1) => {
      if (apiMode()) {
        try {
          await cartService.replaceRemoteCart(partId, amount)
          await refreshRemoteCartSilently()
        } catch (e) {
          setCartError(getFetchErrorMessage(e))
        }
        return
      }
      const part = PARTS_CATALOG.find((p) => p.id === partId)
      if (!part) return
      const qty = Math.min(Math.max(1, Math.floor(Number(amount) || 1)), part.totalStock)
      if (qty <= 0) return
      setQuantities({ [partId]: qty })
    },
    [refreshRemoteCartSilently],
  )

  const lineItems = useMemo(() => {
    if (apiMode()) {
      if (!remoteSnapshot) return []
      return remoteSnapshot.items.map((row) => {
        const part = mapApiProductToPart(row.product)
        return {
          part,
          qty: row.quantity,
          lineTotal: row.lineTotal,
        }
      })
    }
    return PARTS_CATALOG.filter((p) => (quantities[p.id] ?? 0) > 0).map((p) => ({
      part: p,
      qty: quantities[p.id],
      lineTotal: p.price * quantities[p.id],
    }))
  }, [remoteSnapshot, quantities])

  const itemCount = useMemo(() => {
    if (apiMode()) return remoteSnapshot?.itemCount ?? 0
    return Object.values(quantities).reduce((a, b) => a + b, 0)
  }, [remoteSnapshot, quantities])

  const subtotal = useMemo(() => {
    if (apiMode()) return remoteSnapshot?.subtotal ?? 0
    return lineItems.reduce((s, l) => s + l.lineTotal, 0)
  }, [remoteSnapshot, lineItems])

  const openCart = useCallback(() => setDrawerOpen(true), [])
  const closeCart = useCallback(() => setDrawerOpen(false), [])

  const value = useMemo(
    () => ({
      quantities,
      getQty,
      addToCart,
      setPartQty,
      removeFromCart,
      clearCart,
      replaceCartWith,
      lineItems,
      itemCount,
      subtotal,
      drawerOpen,
      openCart,
      closeCart,
      cartError,
      cartLoading,
      retryCart,
      refreshCart: refreshRemoteCartSilently,
    }),
    [
      quantities,
      getQty,
      addToCart,
      setPartQty,
      removeFromCart,
      clearCart,
      replaceCartWith,
      lineItems,
      itemCount,
      subtotal,
      drawerOpen,
      openCart,
      closeCart,
      cartError,
      cartLoading,
      retryCart,
      refreshRemoteCartSilently,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
