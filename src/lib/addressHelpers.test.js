import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAddressPayload } from './addressHelpers.js'

const baseForm = {
  line1: 'Line 1',
  line2: '',
  city: 'City',
  state: '',
  pincode: '123456',
  country: 'IN',
  label: 'Home',
  isDefault: false,
}

test('buildAddressPayload sets gstNumber to null when not purchasing as business', () => {
  const payload = buildAddressPayload({
    ...baseForm,
    isBusinessPurchase: false,
    gstNumber: '29ABCDE1234F2Z5',
  })

  assert.equal(payload.gstNumber, null)
})

test('buildAddressPayload normalizes gstNumber when purchasing as business', () => {
  const payload = buildAddressPayload({
    ...baseForm,
    isBusinessPurchase: true,
    gstNumber: ' 29abcde1234f2z5 ',
  })

  assert.equal(payload.gstNumber, '29ABCDE1234F2Z5')
})

test('buildAddressPayload keeps gstNumber null when business purchase has empty gst', () => {
  const payload = buildAddressPayload({
    ...baseForm,
    isBusinessPurchase: true,
    gstNumber: '   ',
  })

  assert.equal(payload.gstNumber, null)
})
