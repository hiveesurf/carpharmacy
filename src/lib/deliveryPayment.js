import { formatInr } from '../data/partsCatalog.js'
import {
  normalizePaymentMethod,
  normalizePaymentProvider,
  normalizePaymentStatus,
  normalizeOrderStatus,
  isCashOnDeliveryOrder,
  isRazorpayOrder,
  isOrderPaymentPaid,
} from './orderPaymentNormalize.js'

export const AMOUNT_UNAVAILABLE_LABEL = 'Amount unavailable'

const ONLINE_METHODS = new Set(['upi', 'card', 'netbanking', 'wallet'])

/**
 * @param {object | null | undefined} order
 * @returns {number | null}
 */
export function resolveOrderAmount(order) {
  if (!order || typeof order !== 'object') return null
  const candidates = [order.totalInr, order.total, order.totalAmount, order.orderAmount, order.amount]
  for (const c of candidates) {
    if (c == null || c === '') continue
    const n = Number(c)
    if (Number.isNaN(n) || n < 0) continue
    return n
  }
  return null
}

/**
 * @param {object | null | undefined} order
 * @returns {string}
 */
export function formatOrderCurrency(order) {
  const amount = resolveOrderAmount(order)
  if (amount == null) return AMOUNT_UNAVAILABLE_LABEL
  const currency = String(order?.currency ?? 'INR')
    .trim()
    .toUpperCase()
  if (!currency || currency === 'INR') return formatInr(amount)
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString('en-IN')}`
  }
}

/**
 * @param {string | null | undefined} iso
 * @returns {string | null}
 */
export function formatPaidAtLabel(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * @param {object | null | undefined} order
 * @returns {string}
 */
export function resolvePaymentMethodLabel(order) {
  const method = normalizePaymentMethod(order?.paymentMethod)
  const provider = normalizePaymentProvider(order?.paymentProvider)
  if (method === 'cod') return 'Cash on Delivery'
  if (provider === 'razorpay') {
    switch (method) {
      case 'upi':
        return 'UPI'
      case 'card':
        return 'Card'
      case 'netbanking':
        return 'Netbanking'
      case 'wallet':
        return 'Wallet'
      default:
        return 'Razorpay'
    }
  }
  switch (method) {
    case 'upi':
      return 'UPI'
    case 'card':
      return 'Card'
    case 'netbanking':
      return 'Netbanking'
    case 'wallet':
      return 'Wallet'
    default:
      return method ? method.toUpperCase() : '—'
  }
}

/**
 * @param {object | null | undefined} order
 * @returns {import('./deliveryPayment.js').DeliveryPaymentView}
 */
export function resolveDeliveryPaymentView(order) {
  const method = normalizePaymentMethod(order?.paymentMethod)
  const paymentStatus = normalizePaymentStatus(order?.paymentStatus)
  const orderStatus = normalizeOrderStatus(order?.status)
  const isCod = isCashOnDeliveryOrder(order)
  const isPaid = isOrderPaymentPaid(order)
  const isOnline =
    !isCod && (isRazorpayOrder(order) || ONLINE_METHODS.has(method) || Boolean(order?.paymentProvider))
  const amountValue = resolveOrderAmount(order)
  const amountLabel = formatOrderCurrency(order)
  const amountAvailable = amountValue != null
  const isDelivered = orderStatus === 'delivered'
  const knownPayment = Boolean(order?.paymentMethod || order?.paymentProvider)

  const baseUnknown = {
    tone: 'warning',
    paymentMethodLabel: '—',
    paymentStatusLabel: 'Payment status unavailable',
    amountLabel: AMOUNT_UNAVAILABLE_LABEL,
    amountValue: null,
    amountAvailable: false,
    showCollectionAmount: false,
    showCollectedAmount: false,
    showAmountCard: false,
    amountCardTitle: null,
    requiresCashConfirmation: false,
    canConfirmCashCollection: false,
    noCollectionRequired: false,
    warningMessage: 'Payment status unavailable. Verify the order before completing delivery.',
    listLineText: 'PAYMENT STATUS UNKNOWN',
    canCompleteDelivery: true,
    badgeText: 'Unknown',
    badgeKind: 'unknown',
    collectedAtLabel: null,
  }

  if (!order || !knownPayment) {
    return baseUnknown
  }

  if (isCod) {
    if (isPaid) {
      return {
        tone: 'success',
        paymentMethodLabel: 'Cash on Delivery',
        paymentStatusLabel: 'Collected',
        amountLabel,
        amountValue,
        amountAvailable,
        showCollectionAmount: false,
        showCollectedAmount: amountAvailable,
        showAmountCard: amountAvailable,
        amountCardTitle: 'Amount collected',
        requiresCashConfirmation: false,
        canConfirmCashCollection: false,
        noCollectionRequired: false,
        warningMessage: amountAvailable
          ? null
          : 'Order total unavailable. Payment is marked collected in the system.',
        listLineText: amountAvailable ? `COD • Collected ${amountLabel}` : 'COD • Collected',
        canCompleteDelivery: true,
        badgeText: 'COD',
        badgeKind: 'cod',
        collectedAtLabel: formatPaidAtLabel(order?.paidAt),
      }
    }

    return {
      tone: amountAvailable ? 'cod_collect' : 'warning',
      paymentMethodLabel: 'Cash on Delivery',
      paymentStatusLabel: isDelivered ? 'Collected' : 'To be collected',
      amountLabel,
      amountValue,
      amountAvailable,
      showCollectionAmount: !isPaid && amountAvailable,
      showCollectedAmount: false,
      showAmountCard: amountAvailable && !isPaid,
      amountCardTitle: 'Amount to collect',
      requiresCashConfirmation: !isPaid && !isDelivered,
      canConfirmCashCollection: !isPaid && !isDelivered && amountAvailable,
      noCollectionRequired: false,
      warningMessage: amountAvailable
        ? null
        : 'Order total unavailable. Verify the order before collecting cash.',
      listLineText: amountAvailable ? `COD • Collect ${amountLabel}` : 'COD • Collect —',
      canCompleteDelivery: true,
      badgeText: 'COD',
      badgeKind: 'cod',
      collectedAtLabel: null,
    }
  }

  if (isOnline) {
    if (isPaid) {
      return {
        tone: 'success',
        paymentMethodLabel: resolvePaymentMethodLabel(order),
        paymentStatusLabel: 'Paid',
        amountLabel,
        amountValue,
        amountAvailable,
        showCollectionAmount: false,
        showCollectedAmount: false,
        showAmountCard: false,
        amountCardTitle: null,
        requiresCashConfirmation: false,
        canConfirmCashCollection: false,
        noCollectionRequired: true,
        warningMessage: null,
        listLineText: 'PAID ONLINE',
        canCompleteDelivery: true,
        badgeText: 'Paid',
        badgeKind: 'paid',
        collectedAtLabel: formatPaidAtLabel(order?.paidAt),
      }
    }

    const statusLabels = {
      pending: 'Payment pending',
      failed: 'Payment failed',
      cancelled: 'Payment cancelled',
      refunded: 'Refunded',
      authorized: 'Payment authorized',
    }

    return {
      tone: paymentStatus === 'failed' || paymentStatus === 'cancelled' ? 'danger' : 'neutral',
      paymentMethodLabel: resolvePaymentMethodLabel(order),
      paymentStatusLabel: statusLabels[paymentStatus] || 'Payment status unavailable',
      amountLabel,
      amountValue,
      amountAvailable,
      showCollectionAmount: false,
      showCollectedAmount: false,
      showAmountCard: false,
      amountCardTitle: null,
      requiresCashConfirmation: false,
      canConfirmCashCollection: false,
      noCollectionRequired: true,
      warningMessage:
        paymentStatus === 'pending' || paymentStatus === 'failed' || paymentStatus === 'cancelled'
          ? null
          : 'Payment status unavailable. Verify the order before completing delivery.',
      listLineText: (statusLabels[paymentStatus] || 'PAYMENT STATUS UNKNOWN').toUpperCase(),
      canCompleteDelivery: true,
      badgeText: 'Online',
      badgeKind: 'online_pending',
      collectedAtLabel: null,
    }
  }

  return baseUnknown
}

/**
 * Legacy compact shape used by badges and older call sites.
 * @param {object | null | undefined} order
 */
export function resolveDeliveryPayment(order) {
  const view = resolveDeliveryPaymentView(order)
  return {
    kind:
      view.badgeKind === 'cod'
        ? 'cod'
        : view.badgeKind === 'paid'
          ? 'paid'
          : 'online_pending',
    badgeText: view.badgeText,
    badgeSub: view.paymentMethodLabel,
    showAmountToCollect: view.showCollectionAmount,
    amountFormatted: view.amountAvailable ? view.amountLabel : null,
    listLineText: view.listLineText,
  }
}

/**
 * @param {string | null | undefined} name
 */
export function customerInitials(name) {
  const parts = String(name ?? 'Customer')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'C'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** @typedef {'cod_collect' | 'success' | 'warning' | 'neutral' | 'danger'} DeliveryPaymentTone */

/**
 * @typedef {{
 *   tone: DeliveryPaymentTone,
 *   paymentMethodLabel: string,
 *   paymentStatusLabel: string,
 *   amountLabel: string,
 *   amountValue: number | null,
 *   amountAvailable: boolean,
 *   showCollectionAmount: boolean,
 *   showCollectedAmount: boolean,
 *   showAmountCard: boolean,
 *   amountCardTitle: string | null,
 *   requiresCashConfirmation: boolean,
 *   canConfirmCashCollection: boolean,
 *   noCollectionRequired: boolean,
 *   warningMessage: string | null,
 *   listLineText: string,
 *   canCompleteDelivery: boolean,
 *   badgeText: string,
 *   badgeKind: 'cod' | 'paid' | 'online_pending' | 'unknown',
 *   collectedAtLabel: string | null,
 * }} DeliveryPaymentView
 */
