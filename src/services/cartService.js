import * as cartApi from '../api/cartApi.js'
import { apiV1Base } from '../api/client.js'
import { setApiSessionId } from '../api/session.js'

export async function fetchCart() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await cartApi.getCart()
  return data
}

export async function addCartLine(productId, quantity = 1) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await cartApi.postCart(productId, quantity)
  if (data?.guestSessionId) setApiSessionId(data.guestSessionId)
  return data
}

export async function updateCartLine(itemId, quantity) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await cartApi.putCartItem(itemId, quantity)
  return data
}

export async function removeCartLine(itemId) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await cartApi.deleteCartItem(itemId)
  return data
}

export async function clearRemoteCart() {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  const { data } = await cartApi.deleteEntireCart()
  return data
}

/** Replaces the remote cart with a single product line (Buy Now). */
export async function replaceRemoteCart(productId, quantity = 1) {
  if (!apiV1Base()) throw new Error('API_UNAVAILABLE')
  await clearRemoteCart()
  return addCartLine(productId, quantity)
}
