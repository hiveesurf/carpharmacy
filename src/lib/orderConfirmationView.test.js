import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONFIRMATION_VIEW,
  resolveOrderConfirmationView,
} from './orderConfirmationView.js'

const razorpayBase = {
  paymentMethod: 'upi',
  paymentProvider: 'razorpay',
}

test('razorpay paid shows order confirmed', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_1',
    status: 'placed',
    paymentStatus: 'paid',
    ...razorpayBase,
    latestPaymentAttempt: { status: 'paid' },
  })
  assert.equal(view.view, CONFIRMATION_VIEW.RAZORPAY_PAID)
  assert.match(view.description, /payment was received/i)
})

test('razorpay cancelled attempt shows payment cancelled', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_2',
    status: 'draft',
    paymentStatus: 'pending',
    ...razorpayBase,
    latestPaymentAttempt: { status: 'cancelled' },
  })
  assert.equal(view.view, CONFIRMATION_VIEW.RAZORPAY_CANCELLED)
  assert.match(view.heading, /cancelled/i)
  assert.doesNotMatch(view.description, /payment was received/i)
})

test('razorpay draft pending created attempt shows payment pending', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_3',
    status: 'draft',
    paymentStatus: 'pending',
    ...razorpayBase,
    latestPaymentAttempt: { status: 'created' },
  })
  assert.equal(view.view, CONFIRMATION_VIEW.RAZORPAY_PENDING)
  assert.match(view.heading, /pending/i)
  assert.notEqual(view.view, CONFIRMATION_VIEW.RAZORPAY_CANCELLED)
})

test('razorpay draft pending without attempt shows payment pending', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_3b',
    status: 'draft',
    paymentStatus: 'pending',
    ...razorpayBase,
    latestPaymentAttempt: null,
  })
  assert.equal(view.view, CONFIRMATION_VIEW.RAZORPAY_PENDING)
})

test('razorpay failed shows payment failed', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_4',
    status: 'draft',
    paymentStatus: 'failed',
    ...razorpayBase,
    latestPaymentAttempt: { status: 'failed' },
  })
  assert.equal(view.view, CONFIRMATION_VIEW.RAZORPAY_FAILED)
})

test('cod placed pending shows order confirmed pay on delivery', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_5',
    status: 'placed',
    paymentStatus: 'pending',
    paymentMethod: 'cod',
    paymentProvider: 'cod',
  })
  assert.equal(view.view, CONFIRMATION_VIEW.COD_CONFIRMED)
  assert.match(view.description, /pay when your order is delivered/i)
})

test('cod delivered paid shows collected on delivery', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_6',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'cod',
    paymentProvider: 'cod',
    paidAt: '2024-01-02T00:00:00Z',
  })
  assert.equal(view.view, CONFIRMATION_VIEW.COD_COLLECTED)
  assert.match(view.description, /collected/i)
})

test('cod placed paid without delivery shows inconsistent warning', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_7',
    status: 'placed',
    paymentStatus: 'paid',
    paymentMethod: 'cod',
    paymentProvider: 'cod',
  })
  assert.equal(view.view, CONFIRMATION_VIEW.COD_INCONSISTENT)
  assert.doesNotMatch(view.description, /collected/i)
})

test('paid backend state is not overridden by stale navigation assumptions', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_8',
    status: 'placed',
    paymentStatus: 'paid',
    ...razorpayBase,
    latestPaymentAttempt: { status: 'paid' },
  })
  assert.equal(view.view, CONFIRMATION_VIEW.RAZORPAY_PAID)
})

test('unknown state uses neutral fallback', () => {
  const view = resolveOrderConfirmationView({
    id: 'ord_9',
    status: 'processing',
    paymentStatus: 'weird',
    paymentMethod: 'wallet',
    paymentProvider: 'manual',
  })
  assert.equal(view.view, CONFIRMATION_VIEW.NEUTRAL)
})
