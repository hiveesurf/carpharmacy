/** @param {string | null | undefined} value */
export function normalizePaymentMethod(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  if (raw === 'cash_on_delivery' || raw === 'cashondelivery') return 'cod'
  if (['cod', 'upi', 'card', 'netbanking', 'wallet'].includes(raw)) return raw
  return raw || ''
}

/** @param {string | null | undefined} value */
export function normalizePaymentProvider(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
  if (raw === 'razorpay' || raw === 'cod' || raw === 'manual') return raw
  return raw || ''
}

/** @param {string | null | undefined} value */
export function normalizeOrderStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

/** @param {string | null | undefined} value */
export function normalizePaymentStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

/** @param {string | null | undefined} value */
export function normalizePaymentAttemptStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

/** @param {{ paymentMethod?: string } | null | undefined} order */
export function isCashOnDeliveryOrder(order) {
  return normalizePaymentMethod(order?.paymentMethod) === 'cod'
}

/** @param {{ paymentProvider?: string, paymentMethod?: string } | null | undefined} order */
export function isRazorpayOrder(order) {
  if (isCashOnDeliveryOrder(order)) return false
  const provider = normalizePaymentProvider(order?.paymentProvider)
  if (provider === 'razorpay') return true
  return !isCashOnDeliveryOrder(order) && normalizePaymentMethod(order?.paymentMethod) !== 'cod'
}

/** @param {{ paymentStatus?: string } | null | undefined} order */
export function isOrderPaymentPaid(order) {
  const status = normalizePaymentStatus(order?.paymentStatus)
  return status === 'paid' || status === 'authorized'
}

/** @param {{ latestPaymentAttempt?: { status?: string } | null } | null | undefined} order */
export function latestAttemptStatus(order) {
  return normalizePaymentAttemptStatus(order?.latestPaymentAttempt?.status)
}

/** @param {object | null | undefined} order */
export function canRetryOnlinePayment(order) {
  if (!order?.id) return false
  if (isCashOnDeliveryOrder(order)) return false
  if (!isRazorpayOrder(order)) return false
  if (isOrderPaymentPaid(order)) return false

  const orderStatus = normalizeOrderStatus(order.status)
  if (orderStatus === 'delivered' || orderStatus === 'refunded') return false

  const paymentStatus = normalizePaymentStatus(order.paymentStatus)
  if (!['pending', 'failed', 'cancelled'].includes(paymentStatus)) return false

  return orderStatus === 'draft' || orderStatus === 'placed' || orderStatus === 'cancelled'
}

/**
 * Friendly payment label for order list / confirmation fields.
 * @param {object | null | undefined} order
 */
export function formatOrderPaymentLabel(order) {
  if (!order) return '—'

  const method = normalizePaymentMethod(order.paymentMethod)
  const paymentStatus = normalizePaymentStatus(order.paymentStatus)
  const orderStatus = normalizeOrderStatus(order.status)
  const attempt = latestAttemptStatus(order)

  if (method === 'cod') {
    if (paymentStatus === 'pending') return 'To be paid on delivery'
    if (paymentStatus === 'paid' && orderStatus === 'delivered') return 'Collected on delivery'
    if (paymentStatus === 'paid') return 'Paid'
    return paymentStatus || '—'
  }

  if (isRazorpayOrder(order)) {
    if (paymentStatus === 'paid' || paymentStatus === 'authorized') return 'Paid'
    if (paymentStatus === 'failed' || attempt === 'failed') return 'Failed'
    if (attempt === 'cancelled') return 'Payment cancelled'
    if (paymentStatus === 'pending') return 'Pending'
    if (paymentStatus === 'cancelled') return 'Payment cancelled'
  }

  switch (paymentStatus) {
    case 'pending':
      return 'Payment pending'
    case 'paid':
      return 'Paid'
    case 'failed':
      return 'Payment failed'
    case 'cancelled':
      return 'Payment cancelled'
    case 'refunded':
      return 'Refunded'
    default:
      return order.paymentStatus || '—'
  }
}
