import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AMOUNT_UNAVAILABLE_LABEL,
  formatOrderCurrency,
  resolveDeliveryPayment,
  resolveDeliveryPaymentView,
  resolveOrderAmount,
} from './deliveryPayment.js'

const codPending = {
  id: 'ord_1',
  status: 'shipped',
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  totalInr: 7899,
  currency: 'INR',
  paidAt: null,
}

const codPaid = {
  ...codPending,
  status: 'delivered',
  paymentStatus: 'paid',
  paidAt: '2024-06-01T10:30:00.000Z',
}

const razorpayPaid = {
  id: 'ord_2',
  status: 'shipped',
  paymentMethod: 'upi',
  paymentProvider: 'razorpay',
  paymentStatus: 'paid',
  totalInr: 4200,
  currency: 'INR',
  paidAt: '2024-06-01T09:00:00.000Z',
}

describe('resolveOrderAmount', () => {
  it('uses totalInr as authoritative backend total', () => {
    assert.equal(resolveOrderAmount({ totalInr: 7899, total: 1 }), 7899)
  })

  it('returns null when amount is missing', () => {
    assert.equal(resolveOrderAmount({ paymentMethod: 'cod' }), null)
  })

  it('allows genuine zero totals', () => {
    assert.equal(resolveOrderAmount({ totalInr: 0 }), 0)
  })
})

describe('formatOrderCurrency', () => {
  it('formats INR totals', () => {
    assert.equal(formatOrderCurrency(codPending), '₹7,899')
  })

  it('shows amount unavailable for missing totals', () => {
    assert.equal(formatOrderCurrency({ paymentMethod: 'cod' }), AMOUNT_UNAVAILABLE_LABEL)
  })

  it('never formats missing data as zero rupees', () => {
    assert.notEqual(formatOrderCurrency({ paymentMethod: 'cod' }), '₹0')
  })
})

describe('resolveDeliveryPaymentView', () => {
  it('COD pending shows amount to collect', () => {
    const view = resolveDeliveryPaymentView(codPending)
    assert.equal(view.paymentMethodLabel, 'Cash on Delivery')
    assert.equal(view.paymentStatusLabel, 'To be collected')
    assert.equal(view.showCollectionAmount, true)
    assert.equal(view.amountCardTitle, 'Amount to collect')
    assert.equal(view.amountLabel, '₹7,899')
    assert.equal(view.requiresCashConfirmation, true)
  })

  it('COD paid shows amount collected without collection confirmation', () => {
    const view = resolveDeliveryPaymentView(codPaid)
    assert.equal(view.paymentStatusLabel, 'Collected')
    assert.equal(view.showCollectionAmount, false)
    assert.equal(view.requiresCashConfirmation, false)
    assert.equal(view.showCollectedAmount, true)
    assert.equal(view.amountLabel, '₹7,899')
    assert.ok(view.collectedAtLabel)
  })

  it('online paid shows no cash collection required', () => {
    const view = resolveDeliveryPaymentView(razorpayPaid)
    assert.equal(view.paymentStatusLabel, 'Paid')
    assert.equal(view.noCollectionRequired, true)
    assert.equal(view.showCollectionAmount, false)
    assert.equal(view.requiresCashConfirmation, false)
    assert.equal(view.listLineText, 'PAID ONLINE')
  })

  it('online paid is never treated as COD', () => {
    const view = resolveDeliveryPaymentView(razorpayPaid)
    assert.notEqual(view.paymentMethodLabel, 'Cash on Delivery')
    assert.equal(view.badgeKind, 'paid')
  })

  it('missing amount shows amount unavailable and blocks cash confirmation', () => {
    const view = resolveDeliveryPaymentView({
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      status: 'shipped',
    })
    assert.equal(view.amountLabel, AMOUNT_UNAVAILABLE_LABEL)
    assert.equal(view.canConfirmCashCollection, false)
    assert.equal(view.requiresCashConfirmation, true)
    assert.notEqual(view.amountLabel, '₹0')
  })

  it('unknown payment uses neutral warning', () => {
    const view = resolveDeliveryPaymentView({ id: 'ord_x', status: 'shipped' })
    assert.equal(view.listLineText, 'PAYMENT STATUS UNKNOWN')
    assert.match(view.warningMessage, /Verify the order/)
  })

  it('delivery list line for COD pending includes collect amount', () => {
    const view = resolveDeliveryPaymentView(codPending)
    assert.equal(view.listLineText, 'COD • Collect ₹7,899')
  })

  it('delivery list line for COD paid includes collected amount', () => {
    const view = resolveDeliveryPaymentView(codPaid)
    assert.equal(view.listLineText, 'COD • Collected ₹7,899')
  })
})

describe('resolveDeliveryPayment legacy adapter', () => {
  it('exposes formatted amount for COD pending list cards', () => {
    const pay = resolveDeliveryPayment(codPending)
    assert.equal(pay.showAmountToCollect, true)
    assert.equal(pay.amountFormatted, '₹7,899')
  })
})

describe('mark-as-delivered dialog data', () => {
  it('uses the same backend amount as the details view', () => {
    const view = resolveDeliveryPaymentView(codPending)
    assert.equal(view.amountLabel, formatOrderCurrency(codPending))
    assert.equal(view.canConfirmCashCollection, true)
  })

  it('does not allow cash confirmation copy when amount is unknown', () => {
    const view = resolveDeliveryPaymentView({
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      status: 'shipped',
    })
    assert.equal(view.canConfirmCashCollection, false)
  })
})

describe('refresh/direct URL reconstruction', () => {
  it('derives paid COD state purely from backend fields', () => {
    const refreshed = resolveDeliveryPaymentView({
      id: 'ord_1',
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      total: 7899,
      totalInr: 7899,
      currency: 'INR',
      paidAt: '2024-06-01T10:30:00.000Z',
    })
    assert.equal(refreshed.paymentStatusLabel, 'Collected')
    assert.equal(refreshed.requiresCashConfirmation, false)
  })
})
