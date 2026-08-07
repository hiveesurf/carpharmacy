import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isNamedSensitiveEndpoint,
  isPrivilegedAppPath,
  isPublicCatalogApiPath,
  isSensitiveApiPath,
  resolveCacheStrategy,
  shouldOfferOfflineFallback,
  workboxRuntimeStrategy,
} from './pwaCachePolicy.js'

function req(url, extras = {}) {
  return { url, method: 'GET', headers: {}, ...extras }
}

const authHeaders = { Authorization: 'Bearer secret-token' }

describe('resolveCacheStrategy — bypass exclusions (no Workbox runtime strategy)', () => {
  const bypassUrls = [
    '/admin',
    '/admin/orders',
    '/admin/sales-report',
    '/admin/reconciliation',
    '/delivery',
    '/delivery/orders/abc',
    '/api/v1/auth/otp/request',
    '/api/v1/auth/me',
    '/api/v1/auth/refresh-token',
    '/api/v1/auth/notifications',
    '/api/v1/admin/dashboard',
    '/api/v1/admin/me',
    '/api/v1/admin/notifications',
    '/api/v1/admin/orders',
    '/api/v1/admin/sales-report',
    '/api/v1/admin/reconciliation',
    '/api/v1/orders',
    '/api/v1/orders/ord-1',
    '/api/v1/payments/create-order',
    '/api/v1/payments/verify',
    '/api/v1/payments/webhook',
    '/api/v1/cart',
    '/api/v1/user/profile',
    '/api/v1/wishlist',
    // Literal short names as seen in Network tab labels
    '/cart',
    '/me',
    '/dashboard',
    '/notifications',
    '/refresh-token',
  ]

  for (const url of bypassUrls) {
    it(`bypasses Workbox for ${url}`, () => {
      assert.equal(resolveCacheStrategy(req(url)), 'bypass')
      assert.equal(workboxRuntimeStrategy(req(url)), null)
    })
  }

  it('treats any Authorization-bearing request as bypass even for catalog paths', () => {
    assert.equal(
      resolveCacheStrategy(
        req('/api/v1/products', {
          headers: authHeaders,
        }),
      ),
      'bypass',
    )
    assert.equal(
      workboxRuntimeStrategy(
        req('/api/v1/products', {
          headers: new Headers({ authorization: 'Bearer secret-token' }),
        }),
      ),
      null,
    )
  })

  it('treats non-GET as bypass', () => {
    assert.equal(resolveCacheStrategy(req('/api/v1/products', { method: 'POST' })), 'bypass')
    assert.equal(workboxRuntimeStrategy(req('/api/v1/products', { method: 'POST' })), null)
  })
})

describe('regression — five admin Network-tab endpoints never get a Workbox strategy', () => {
  const five = [
    { label: 'cart', urls: ['/cart', '/api/v1/cart'] },
    { label: 'dashboard', urls: ['/dashboard', '/api/v1/admin/dashboard'] },
    { label: 'notifications', urls: ['/notifications', '/api/v1/admin/notifications', '/api/v1/auth/notifications'] },
    { label: 'me', urls: ['/me', '/api/v1/auth/me', '/api/v1/admin/me'] },
    { label: 'refresh-token', urls: ['/refresh-token', '/api/v1/auth/refresh-token'] },
  ]

  for (const { label, urls } of five) {
    for (const url of urls) {
      it(`${label}: ${url} with Authorization is not served via any Workbox strategy`, () => {
        assert.equal(isNamedSensitiveEndpoint(url), true)
        const strategy = workboxRuntimeStrategy(
          req(url, { headers: authHeaders }),
        )
        assert.equal(
          strategy,
          null,
          `expected no Workbox strategy for ${url}, got ${strategy}`,
        )
        assert.notEqual(strategy, 'stale-while-revalidate')
        assert.notEqual(strategy, 'cache-first')
        assert.notEqual(resolveCacheStrategy(req(url, { headers: authHeaders })), 'stale-while-revalidate')
      })

      it(`${label}: ${url} without Authorization still bypasses Workbox`, () => {
        assert.equal(workboxRuntimeStrategy(req(url)), null)
      })
    }
  }
})

describe('resolveCacheStrategy — allowed public caching', () => {
  it('uses stale-while-revalidate for public catalog reads', () => {
    assert.equal(resolveCacheStrategy(req('/api/v1/products')), 'stale-while-revalidate')
    assert.equal(workboxRuntimeStrategy(req('/api/v1/products')), 'stale-while-revalidate')
    assert.equal(resolveCacheStrategy(req('/api/v1/products/p1')), 'stale-while-revalidate')
    assert.equal(resolveCacheStrategy(req('/api/v1/categories')), 'stale-while-revalidate')
    assert.equal(resolveCacheStrategy(req('/api/v1/cars')), 'stale-while-revalidate')
    assert.equal(resolveCacheStrategy(req('/api/v1/vehicle/brands')), 'stale-while-revalidate')
  })

  it('uses cache-first for product/static images', () => {
    assert.equal(resolveCacheStrategy(req('/images/oil.jpg')), 'cache-first')
    assert.equal(workboxRuntimeStrategy(req('/images/oil.jpg')), 'cache-first')
    assert.equal(resolveCacheStrategy(req('/icons/pwa-192x192.png')), 'cache-first')
    assert.equal(
      resolveCacheStrategy(req('/cdn/foo.png', { destination: 'image' })),
      'cache-first',
    )
  })

  it('does not classify admin product APIs as public catalog', () => {
    assert.equal(isPublicCatalogApiPath('/api/v1/admin/products'), false)
    assert.equal(isSensitiveApiPath('/api/v1/admin/products'), true)
    assert.equal(workboxRuntimeStrategy(req('/api/v1/admin/products')), null)
  })
})

describe('offline fallback scope', () => {
  it('allows storefront navigations', () => {
    assert.equal(shouldOfferOfflineFallback('/'), true)
    assert.equal(shouldOfferOfflineFallback('/catalog'), true)
    assert.equal(shouldOfferOfflineFallback('/cart'), true)
  })

  it('refuses admin and delivery navigations', () => {
    assert.equal(shouldOfferOfflineFallback('/admin'), false)
    assert.equal(shouldOfferOfflineFallback('/admin/orders'), false)
    assert.equal(shouldOfferOfflineFallback('/delivery/orders/1'), false)
    assert.equal(isPrivilegedAppPath('/admin/sales-report'), true)
    assert.equal(isPrivilegedAppPath('/delivery'), true)
  })

  it('refuses API paths', () => {
    assert.equal(shouldOfferOfflineFallback('/api/v1/products'), false)
  })
})
