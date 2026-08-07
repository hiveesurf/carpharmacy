import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPushNotification, resolveNotificationClickUrl } from './pwaPushHandlers.js'
import {
  dismissInstallPrompt,
  isInstallPromptCoolingDown,
  shouldShowInstallPrompt,
} from './pwaInstallPrompt.js'

describe('pwaPushHandlers — notification click (merge regression)', () => {
  it('opens the payload URL when present', () => {
    assert.equal(resolveNotificationClickUrl({ data: { url: '/orders/abc' } }), '/orders/abc')
  })

  it('falls back to storefront home when url is missing', () => {
    assert.equal(resolveNotificationClickUrl({ data: {} }), '/')
    assert.equal(resolveNotificationClickUrl(null), '/')
  })

  it('builds title/body/icon like the former sw-push.js handler', () => {
    const { title, options } = buildPushNotification({
      json: () => ({
        title: 'Order update',
        body: 'Out for delivery',
        data: { url: '/orders/1' },
      }),
    })
    assert.equal(title, 'Order update')
    assert.equal(options.body, 'Out for delivery')
    assert.equal(options.data.url, '/orders/1')
    assert.equal(options.icon, '/logo-carnalysys.png')
    assert.equal(options.badge, '/logo-carnalysys.png')
  })

  it('tolerates invalid push JSON', () => {
    const { title, options } = buildPushNotification({
      json: () => {
        throw new Error('bad json')
      },
    })
    assert.equal(title, 'Notification')
    assert.equal(options.body, '')
  })
})

describe('pwaInstallPrompt', () => {
  it('hides on admin/delivery paths', () => {
    assert.equal(shouldShowInstallPrompt({ pathname: '/admin', navCount: 99, cartItemCount: 5 }), false)
    assert.equal(shouldShowInstallPrompt({ pathname: '/delivery/orders', navCount: 99 }), false)
  })

  it('shows after engagement (nav count or cart)', () => {
    assert.equal(shouldShowInstallPrompt({ pathname: '/', navCount: 1, cartItemCount: 0, now: 0 }), false)
    assert.equal(shouldShowInstallPrompt({ pathname: '/catalog', navCount: 2, cartItemCount: 0, now: 0 }), true)
    assert.equal(shouldShowInstallPrompt({ pathname: '/', navCount: 0, cartItemCount: 1, now: 0 }), true)
  })

  it('respects dismissal cool-down via localStorage-shaped helpers', () => {
    const store = new Map()
    const original = globalThis.localStorage
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    }
    try {
      assert.equal(isInstallPromptCoolingDown(1_000), false)
      dismissInstallPrompt(1_000)
      assert.equal(isInstallPromptCoolingDown(1_000 + 60_000), true)
      assert.equal(
        shouldShowInstallPrompt({ pathname: '/catalog', navCount: 5, now: 1_000 + 60_000 }),
        false,
      )
    } finally {
      globalThis.localStorage = original
    }
  })
})
