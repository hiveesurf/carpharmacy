import { formatOrderPaymentLabel, isCashOnDeliveryOrder } from './orderPaymentNormalize.js'

export { isCashOnDeliveryOrder as isCashOnDelivery }

/**
 * Human-readable payment status from backend order data.
 * @param {object | null | undefined} order
 */
export function formatPaymentStatus(order) {
  return formatOrderPaymentLabel(order)
}
