import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toUserFacingApiError } from './apiUserMessage.js'

describe('toUserFacingApiError — rate limited', () => {
  it('surfaces a clear 429 / RATE_LIMITED message with retry hint', () => {
    const { message, code } = toUserFacingApiError(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests, please try again later.',
          details: { retryAfterSeconds: 30 },
        },
      },
      429,
    )
    assert.equal(code, 'RATE_LIMITED')
    assert.match(message, /Too many requests/i)
    assert.match(message, /30/)
  })

  it('handles bare 429 without envelope message', () => {
    const { message, code } = toUserFacingApiError({}, 429)
    assert.equal(code, 'RATE_LIMITED')
    assert.match(message, /Too many requests/i)
    assert.match(message, /wait/i)
  })
})
