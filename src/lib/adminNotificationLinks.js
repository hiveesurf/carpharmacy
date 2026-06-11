/**
 * @param {{ topic?: string, sourceType?: string, sourceId?: string, payload?: Record<string, unknown> }} n
 */
export function isAdminLowStockNotification(n) {
  const topic = String(n?.topic ?? '')
  const payloadType = String(n?.payload?.type ?? '')
  return topic === 'admin_low_stock' || payloadType === 'LOW_STOCK'
}

/**
 * @param {{ topic?: string, sourceType?: string, sourceId?: string, payload?: Record<string, unknown> }} n
 * @returns {string | null}
 */
export function adminNotificationTargetPath(n) {
  if (isAdminLowStockNotification(n)) {
    return '/admin/products?lowStock=1'
  }
  const orderLinked =
    n?.sourceType === 'order' ||
    n?.topic === 'admin_new_order' ||
    n?.topic === 'admin_delivery_completed' ||
    n?.topic === 'admin_order_assigned' ||
    n?.topic === 'admin_alerts'
  if (orderLinked && n?.sourceId) {
    return '/admin/orders'
  }
  return null
}
