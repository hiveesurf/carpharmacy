import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPaymentStatus } from './orderPaymentStatus.js'

test('shows COD pending as to be paid on delivery', () => {
  assert.equal(
    formatPaymentStatus({ paymentMethod: 'cod', paymentStatus: 'pending' }),
    'To be paid on delivery',
  )
})

test('does not show COD pending as paid', () => {
  const label = formatPaymentStatus({ paymentMethod: 'cod', paymentStatus: 'pending' })
  assert.notEqual(label, 'Paid')
  assert.equal(label, 'To be paid on delivery')
})

test('maps standard payment statuses', () => {
  assert.equal(
    formatPaymentStatus({ paymentMethod: 'upi', paymentProvider: 'razorpay', paymentStatus: 'pending' }),
    'Pending',
  )
  assert.equal(formatPaymentStatus({ paymentStatus: 'paid' }), 'Paid')
  assert.equal(
    formatPaymentStatus({ paymentMethod: 'upi', paymentProvider: 'razorpay', paymentStatus: 'failed' }),
    'Failed',
  )
  assert.equal(formatPaymentStatus({ paymentStatus: 'refunded' }), 'Refunded')
})
