/**
 * Whether Checkout should send the customer back to the cart page.
 * @param {{
 *   authHydrated: boolean,
 *   apiOn: boolean,
 *   cartLoading: boolean,
 *   itemCount: number,
 *   cartError: unknown,
 *   checkoutStarted: boolean,
 * }} params
 */
export function shouldRedirectCheckoutToCart({
  authHydrated,
  apiOn,
  cartLoading,
  itemCount,
  cartError,
  checkoutStarted,
}) {
  if (!authHydrated || !apiOn || cartLoading) return false
  if (checkoutStarted) return false
  return itemCount <= 0 && !cartError
}
