import {
  canRetryOnlinePayment,
  isCashOnDeliveryOrder,
  isOrderPaymentPaid,
  isRazorpayOrder,
  latestAttemptStatus,
  normalizeOrderStatus,
  normalizePaymentStatus,
} from './orderPaymentNormalize.js'

export const CONFIRMATION_VIEW = {
  RAZORPAY_PAID: 'razorpay_paid',
  COD_CONFIRMED: 'cod_confirmed',
  COD_COLLECTED: 'cod_collected',
  COD_INCONSISTENT: 'cod_inconsistent',
  RAZORPAY_CANCELLED: 'razorpay_cancelled',
  RAZORPAY_FAILED: 'razorpay_failed',
  RAZORPAY_PENDING: 'razorpay_pending',
  NEUTRAL: 'neutral',
}

function baseView(view, heading, description, icon, showRetry, extras = {}) {
  return {
    view,
    heading,
    description,
    secondaryMessage: extras.secondaryMessage ?? null,
    alert: extras.alert ?? null,
    icon,
    showRetry,
  }
}

/**
 * Derive confirmation-page UI from backend order fields.
 * @param {object | null | undefined} order
 */
export function resolveOrderConfirmationView(order) {
  if (!order?.id) {
    return neutralView()
  }

  const orderStatus = normalizeOrderStatus(order.status)
  const paymentStatus = normalizePaymentStatus(order.paymentStatus)
  const attemptStatus = latestAttemptStatus(order)
  const cod = isCashOnDeliveryOrder(order)
  const razorpay = isRazorpayOrder(order)
  const paid = isOrderPaymentPaid(order)
  const hasPaidAt = Boolean(order.paidAt)

  if (razorpay && paid) {
    return baseView(
      CONFIRMATION_VIEW.RAZORPAY_PAID,
      'Order confirmed',
      'Thank you. Your payment was received and your order is confirmed.',
      'success',
      false,
    )
  }

  if (razorpay && (paymentStatus === 'failed' || attemptStatus === 'failed')) {
    return baseView(
      CONFIRMATION_VIEW.RAZORPAY_FAILED,
      'Payment failed',
      'Your payment could not be completed. No amount was charged.',
      'error',
      canRetryOnlinePayment(order),
    )
  }

  if (
    razorpay &&
    orderStatus === 'draft' &&
    paymentStatus === 'pending' &&
    attemptStatus === 'cancelled'
  ) {
    return baseView(
      CONFIRMATION_VIEW.RAZORPAY_CANCELLED,
      'Payment cancelled',
      'Your payment was not completed. Your order has been saved as a draft.',
      'warning',
      canRetryOnlinePayment(order),
      {
        secondaryMessage: 'You can retry the payment now or complete it later from My Orders.',
        alert: 'Payment cancelled — no amount was charged.',
      },
    )
  }

  if (
    razorpay &&
    orderStatus === 'draft' &&
    paymentStatus === 'pending' &&
    (attemptStatus === '' ||
      attemptStatus === 'created' ||
      attemptStatus === 'authorized' ||
      attemptStatus === 'pending')
  ) {
    return baseView(
      CONFIRMATION_VIEW.RAZORPAY_PENDING,
      'Payment pending',
      'Your order has been saved, but payment has not been completed.',
      'neutral',
      canRetryOnlinePayment(order),
      {
        secondaryMessage: 'You can retry the payment now or complete it later from My Orders.',
      },
    )
  }

  if (cod && (orderStatus === 'placed' || orderStatus === 'confirmed') && paymentStatus === 'pending') {
    return baseView(
      CONFIRMATION_VIEW.COD_CONFIRMED,
      'Order confirmed',
      'Your order has been confirmed. Please pay when your order is delivered.',
      'success',
      false,
    )
  }

  if (cod && paid && (orderStatus === 'delivered' || hasPaidAt)) {
    return baseView(
      CONFIRMATION_VIEW.COD_COLLECTED,
      'Order completed',
      'Your order was delivered and the Cash on Delivery payment was collected.',
      'success',
      false,
    )
  }

  if (cod && paid && (orderStatus === 'placed' || orderStatus === 'confirmed')) {
    return baseView(
      CONFIRMATION_VIEW.COD_INCONSISTENT,
      'Payment status needs review',
      'The order is confirmed, but the payment information is inconsistent.',
      'warning',
      false,
    )
  }

  return neutralView()
}

function neutralView() {
  return baseView(
    CONFIRMATION_VIEW.NEUTRAL,
    'Order status',
    'We could not determine the latest payment state. Please refresh or view the order from My Orders.',
    'neutral',
    false,
  )
}
