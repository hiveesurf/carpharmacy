/** Default threshold (units) for admin low-stock warnings. */
export const ADMIN_LOW_STOCK_THRESHOLD = 5

/**
 * @param {Record<string, unknown> | null | undefined} product
 */
export function isAdminOutOfStock(product) {
  return Math.max(0, Math.floor(Number(product?.totalStock ?? 0))) <= 0
}

/**
 * Stock in (0, threshold] for all product types.
 * @param {Record<string, unknown> | null | undefined} product
 * @param {number} [threshold]
 */
export function isAdminLowStock(product, threshold = ADMIN_LOW_STOCK_THRESHOLD) {
  const stock = Math.max(0, Math.floor(Number(product?.totalStock ?? 0)))
  return stock > 0 && stock <= threshold
}

/**
 * Stock above threshold for all product types.
 * @param {Record<string, unknown> | null | undefined} product
 * @param {number} [threshold]
 */
export function isAdminInStock(product, threshold = ADMIN_LOW_STOCK_THRESHOLD) {
  const stock = Math.max(0, Math.floor(Number(product?.totalStock ?? 0)))
  return stock > threshold
}
