export const DELIVERY_HOME_PATH = '/delivery'

export const DELIVERY_LIST_PATH = '/delivery/orders'

export function deliveryDetailPath(orderId) {
  return `/delivery/orders/${encodeURIComponent(orderId)}`
}

export function deliveryOtpPath(orderId) {
  return `/delivery/orders/${encodeURIComponent(orderId)}/otp`
}

export function deliveryProofPath(orderId) {
  return `/delivery/orders/${encodeURIComponent(orderId)}/proof`
}

export function deliverySuccessPath(orderId) {
  return `/delivery/orders/${encodeURIComponent(orderId)}/success`
}
