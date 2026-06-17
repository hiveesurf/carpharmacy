/** @type {string} */
export const CHECKOUT_BUY_NOW_KEY = 'checkout-buy-now-v1'

/** Marks a Buy Now checkout so stale cart merges can be detected. */
export function markBuyNowCheckout(productId) {
  if (!productId) return
  try {
    sessionStorage.setItem(CHECKOUT_BUY_NOW_KEY, String(productId))
  } catch {
    /* ignore */
  }
}

export function clearCheckoutSession() {
  try {
    sessionStorage.removeItem(CHECKOUT_BUY_NOW_KEY)
  } catch {
    /* ignore */
  }
}

export function peekBuyNowProductId() {
  try {
    const id = sessionStorage.getItem(CHECKOUT_BUY_NOW_KEY)
    return id && id.trim() ? id.trim() : null
  } catch {
    return null
  }
}

/**
 * @param {{ orderPlaced: boolean, paymentSucceeded: boolean }} result
 */
export function shouldClearCartAfterCheckout(result) {
  return Boolean(result?.orderPlaced && result?.paymentSucceeded)
}
