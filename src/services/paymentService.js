import { apiPost, apiV1Base } from '../api/client.js'

export async function createPaymentOrder(body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await apiPost('/payments/create-order', body ?? {})
  return data
}

export async function verifyPayment(body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await apiPost('/payments/verify', body ?? {})
  return data
}

export async function cancelPaymentAttempt(orderId) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await apiPost(
    `/payments/${encodeURIComponent(orderId)}/cancel-attempt`,
    {},
  )
  return data
}

/** @deprecated Use createPaymentOrder */
export async function initiatePayment(body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await apiPost('/payments/initiate', body ?? {})
  return data
}

/** @deprecated Use verifyPayment */
export async function confirmPayment(body) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await apiPost('/payments/confirm', body ?? {})
  return data
}
