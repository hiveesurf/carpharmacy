import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldRedirectCheckoutToCart } from './checkoutGuard.js'
import {
  CHECKOUT_BUY_NOW_KEY,
  clearCheckoutSession,
  markBuyNowCheckout,
  peekBuyNowProductId,
  shouldClearCartAfterCheckout,
} from './checkoutSession.js'

const base = {
  authHydrated: true,
  apiOn: true,
  cartLoading: false,
  itemCount: 0,
  cartError: null,
  checkoutStarted: false,
}

test('empty cart before checkout redirects to cart', () => {
  assert.equal(shouldRedirectCheckoutToCart({ ...base, itemCount: 0 }), true)
})

test('empty cart during checkout submission does not redirect', () => {
  assert.equal(
    shouldRedirectCheckoutToCart({ ...base, itemCount: 0, checkoutStarted: true }),
    false,
  )
})

test('empty cart while cart is loading does not redirect', () => {
  assert.equal(shouldRedirectCheckoutToCart({ ...base, cartLoading: true }), false)
})

test('non-empty cart does not redirect', () => {
  assert.equal(shouldRedirectCheckoutToCart({ ...base, itemCount: 2 }), false)
})

test('cart error with empty cart does not redirect', () => {
  assert.equal(
    shouldRedirectCheckoutToCart({ ...base, itemCount: 0, cartError: 'Cart failed' }),
    false,
  )
})

test('shouldClearCartAfterCheckout requires placed order and successful payment', () => {
  assert.equal(shouldClearCartAfterCheckout({ orderPlaced: true, paymentSucceeded: true }), true)
  assert.equal(shouldClearCartAfterCheckout({ orderPlaced: true, paymentSucceeded: false }), false)
  assert.equal(shouldClearCartAfterCheckout({ orderPlaced: false, paymentSucceeded: true }), false)
  assert.equal(shouldClearCartAfterCheckout({ orderPlaced: false, paymentSucceeded: false }), false)
})

test('buy now session marker is set and cleared', () => {
  if (typeof globalThis.sessionStorage === 'undefined') {
    const store = new Map()
    globalThis.sessionStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value))
      },
      removeItem: (key) => {
        store.delete(key)
      },
    }
  }

  markBuyNowCheckout('part-abc')
  assert.equal(peekBuyNowProductId(), 'part-abc')
  clearCheckoutSession()
  assert.equal(peekBuyNowProductId(), null)
  assert.equal(sessionStorage.getItem(CHECKOUT_BUY_NOW_KEY), null)
})
