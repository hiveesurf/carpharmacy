import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canRetryOnlinePayment,
  formatOrderPaymentLabel,
  isCashOnDeliveryOrder,
  isRazorpayOrder,
  normalizePaymentMethod,
} from './orderPaymentNormalize.js'

test('normalizes payment methods', () => {
  assert.equal(normalizePaymentMethod('COD'), 'cod')
  assert.equal(normalizePaymentMethod('cash_on_delivery'), 'cod')
})

test('cod pending label is to be paid on delivery', () => {
  assert.equal(
    formatOrderPaymentLabel({ paymentMethod: 'cod', paymentStatus: 'pending' }),
    'To be paid on delivery',
  )
})

test('razorpay cancelled attempt label', () => {
  assert.equal(
    formatOrderPaymentLabel({
      paymentMethod: 'upi',
      paymentProvider: 'razorpay',
      paymentStatus: 'pending',
      latestPaymentAttempt: { status: 'cancelled' },
    }),
    'Payment cancelled',
  )
})

test('cod never allows retry payment', () => {
  assert.equal(
    canRetryOnlinePayment({
      id: 'ord_cod',
      paymentMethod: 'cod',
      paymentProvider: 'cod',
      status: 'placed',
      paymentStatus: 'pending',
    }),
    false,
  )
})

test('razorpay pending draft allows retry payment', () => {
  assert.equal(
    canRetryOnlinePayment({
      id: 'ord_rz',
      paymentMethod: 'upi',
      paymentProvider: 'razorpay',
      status: 'draft',
      paymentStatus: 'pending',
      latestPaymentAttempt: { status: 'created' },
    }),
    true,
  )
})

test('razorpay paid does not allow retry payment', () => {
  assert.equal(
    canRetryOnlinePayment({
      id: 'ord_paid',
      paymentMethod: 'upi',
      paymentProvider: 'razorpay',
      status: 'placed',
      paymentStatus: 'paid',
    }),
    false,
  )
})

test('isCashOnDeliveryOrder detects cod', () => {
  assert.equal(isCashOnDeliveryOrder({ paymentMethod: 'cod' }), true)
  assert.equal(isRazorpayOrder({ paymentMethod: 'cod', paymentProvider: 'cod' }), false)
})
