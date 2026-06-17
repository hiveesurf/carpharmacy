import { DELIVERY_LIST_PATH, deliveryDetailPath } from './deliveryRoutes.js'

/**
 * @param {{ topic?: string, sourceType?: string, sourceId?: string, payload?: Record<string, unknown> }} n
 */
export function isAdminLowStockNotification(n) {
  const topic = String(n?.topic ?? '')
  const payloadType = String(n?.payload?.type ?? '')
  return topic === 'admin_low_stock' || payloadType === 'LOW_STOCK'
}

function isOrderLinkedNotification(n) {
  return (
    n?.sourceType === 'order' ||
    n?.topic === 'admin_new_order' ||
    n?.topic === 'admin_delivery_completed' ||
    n?.topic === 'admin_order_assigned' ||
    n?.topic === 'admin_alerts'
  )
}

/**
 * @param {{ topic?: string, sourceType?: string, sourceId?: string, payload?: Record<string, unknown> }} n
 * @returns {string | null}
 */
export function deliveryNotificationTargetPath(n) {
  if (isOrderLinkedNotification(n)) {
    if (n?.sourceId) {
      return deliveryDetailPath(n.sourceId)
    }
    return DELIVERY_LIST_PATH
  }
  return null
}

/**
 * @param {{ topic?: string, sourceType?: string, sourceId?: string, payload?: Record<string, unknown> }} n
 * @param {string | null | undefined} [sessionRole]
 * @returns {string | null}
 */
export function notificationTargetPath(n, sessionRole) {
  if (sessionRole === 'delivery') {
    return deliveryNotificationTargetPath(n)
  }
  return adminNotificationTargetPath(n)
}

/**
 * @param {{ topic?: string, sourceType?: string, sourceId?: string, payload?: Record<string, unknown> }} n
 * @returns {string | null}
 */
export function adminNotificationTargetPath(n) {
  if (isAdminLowStockNotification(n)) {
    return '/admin/products?lowStock=1'
  }
  if (isOrderLinkedNotification(n) && n?.sourceId) {
    return '/admin/orders'
  }
  return null
}
