import * as orderService from '../services/orderService.js'

import * as paymentService from '../services/paymentService.js'

import { clearCheckoutSession } from './checkoutSession.js'



export const PAYMENT_OUTCOME = {

  CANCELLED: 'PAYMENT_CANCELLED',

  FAILED: 'PAYMENT_FAILED',

}



/** @param {string} message @param {string} code */

function paymentFlowError(message, code) {

  const err = new Error(message)

  err.code = code

  return err

}



export async function ensureRazorpayScript() {

  if (typeof window !== 'undefined' && window.Razorpay) return true

  await new Promise((resolve, reject) => {

    const existing = document.querySelector('script[data-razorpay-checkout="1"]')

    if (existing) {

      existing.addEventListener('load', () => resolve(), { once: true })

      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay SDK')), {

        once: true,

      })

      return

    }

    const script = document.createElement('script')

    script.src = 'https://checkout.razorpay.com/v1/checkout.js'

    script.async = true

    script.dataset.razorpayCheckout = '1'

    script.onload = () => resolve()

    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'))

    document.body.appendChild(script)

  })

  return Boolean(window.Razorpay)

}



function orderAmountPaise(order) {

  const total = Number(order?.totalInr ?? order?.total ?? 0)

  return Math.round(total * 100)

}



async function recordPaymentCancellation(orderId) {

  try {

    await paymentService.cancelPaymentAttempt(orderId)

  } catch (err) {

    console.warn('Failed to record payment cancellation', err)

  }

}



/**

 * @param {{ order: { id: string, totalInr?: number, total?: number }, user?: { displayName?: string, phone?: string, phoneE164?: string, email?: string, name?: string } }} params

 */

export async function openRazorpayCheckout({ order, user }) {

  const amountPaise = orderAmountPaise(order)

  const init = await paymentService.createPaymentOrder({

    orderId: order.id,

    amount: amountPaise > 0 ? amountPaise : undefined,

  })

  const sdkReady = await ensureRazorpayScript()

  if (!sdkReady || !window.Razorpay) throw new Error('Razorpay SDK not available')

  await new Promise((resolve, reject) => {

    const rz = new window.Razorpay({

      key: init.key,

      amount: init.amount,

      currency: init.currency || 'INR',

      name: 'carpharmacy',

      description: `Order ${order.id}`,

      order_id: init.orderId,

      prefill: {

        name: user?.displayName || user?.name || '',

        contact: user?.phone || user?.phoneE164 || '',

        email: user?.email || '',

      },

      notes: {

        order_id: order.id,

      },

      handler: async (response) => {

        try {

          await paymentService.verifyPayment({

            orderId: order.id,

            razorpay_payment_id: response.razorpay_payment_id,

            razorpay_order_id: response.razorpay_order_id,

            razorpay_signature: response.razorpay_signature,

          })

          resolve()

        } catch (err) {

          reject(

            paymentFlowError(

              err instanceof Error ? err.message : 'Payment verification failed',

              PAYMENT_OUTCOME.FAILED,

            ),

          )

        }

      },

      modal: {

        ondismiss: () => {

          void (async () => {

            await recordPaymentCancellation(order.id)

            reject(paymentFlowError('Payment cancelled', PAYMENT_OUTCOME.CANCELLED))

          })()

        },

      },

    })

    rz.open()

  })

}



/**

 * @param {{ addressId: string, paymentMethod: string, user?: object, clearCart?: () => Promise<void> }} params

 * @returns {Promise<{ order: object, requiresOnlinePayment: boolean }>}

 */

export async function placeOrderWithPayment({ addressId, paymentMethod, user, clearCart }) {

  const order = await orderService.placeOrder({

    addressId,

    paymentMethod,

  })

  const isCod = paymentMethod === 'cod'

  const isPaid = String(order?.paymentStatus || '').toLowerCase() === 'paid'



  try {

    if (!isCod && !isPaid) {

      await openRazorpayCheckout({ order, user })

      const fresh = await orderService.getOrder(order.id)

      if (clearCart) await clearCart()

      clearCheckoutSession()

      return { order: fresh, requiresOnlinePayment: true }

    }

    if (clearCart) await clearCart()

    clearCheckoutSession()

    return { order, requiresOnlinePayment: false }

  } catch (err) {

    const wrapped = err instanceof Error ? err : new Error(String(err))

    wrapped.placedOrder = order

    if (!wrapped.code) {

      wrapped.code = PAYMENT_OUTCOME.FAILED

    }

    throw wrapped

  }

}



/**

 * Retry Razorpay checkout for an existing draft order (no new order is created).

 * @param {{ order: { id: string, totalInr?: number, total?: number }, user?: object }} params

 */

export async function retryRazorpayPayment({ order, user }) {

  await openRazorpayCheckout({ order, user })

  return orderService.getOrder(order.id)

}



export const PAYMENT_OPTIONS = [

  {

    id: 'upi',

    label: 'UPI / Razorpay',

    description: 'Pay securely online with UPI, card, or netbanking via Razorpay.',

  },

  {

    id: 'cod',

    label: 'Cash on Delivery',

    description: 'Pay when your order is delivered. Subject to availability.',

  },

]


