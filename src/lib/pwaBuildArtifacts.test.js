import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('PWA build artifacts (when dist exists)', () => {
  const dist = path.join(root, 'dist')
  const hasDist = fs.existsSync(dist)

  it('service worker source no longer registers a separate sw-push.js', () => {
    const pushJs = fs.readFileSync(path.join(root, 'src/lib/pushNotifications.js'), 'utf8')
    assert.equal(/register\(['"`]\/sw-push\.js['"`]\)/.test(pushJs), false)
    assert.equal(fs.existsSync(path.join(root, 'public/sw-push.js')), false)
    const sw = fs.readFileSync(path.join(root, 'src/sw.js'), 'utf8')
    assert.match(sw, /addEventListener\('push'/)
    assert.match(sw, /addEventListener\('notificationclick'/)
    assert.match(sw, /workboxRuntimeStrategy/)
    assert.match(sw, /shouldOfferOfflineFallback/)
    assert.equal(sw.includes("=== 'network-only'") || sw.includes('=== `network-only`'), false)
  })

  it('emits manifest + service worker with required fields after build', function skipIfNoDist() {
    if (!hasDist) {
      this.skip?.()
      // node:test without this.skip — soft assert
      assert.ok(true, 'dist not present yet; run npm run build first for full check')
      return
    }
    const manifestPath = ['manifest.webmanifest', 'manifest.json']
      .map((f) => path.join(dist, f))
      .find((f) => fs.existsSync(f))
    assert.ok(manifestPath, 'expected manifest.webmanifest in dist')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    assert.match(String(manifest.name), /CarPharmacy/)
    assert.equal(manifest.short_name, 'CarPharmacy')
    assert.equal(manifest.display, 'standalone')
    assert.equal(manifest.start_url, '/')
    assert.equal(manifest.scope, '/')
    assert.equal(manifest.theme_color, '#ff6b35')
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3)

    const swPath = path.join(dist, 'sw.js')
    assert.ok(fs.existsSync(swPath), 'expected dist/sw.js')
    const sw = fs.readFileSync(swPath, 'utf8')
    // Minified SW keeps these string literals from the policy + route config.
    assert.match(sw, /stale-while-revalidate/)
    assert.match(sw, /carpharmacy-public-api/)
    assert.match(sw, /\/admin/)
    assert.match(sw, /\/delivery/)
    assert.match(sw, /refresh-token/)
    assert.match(sw, /authorization/i)
    // No Workbox NetworkOnly matcher for APIs (that still shows Size: ServiceWorker).
    assert.equal(/\=\=\=\s*[`'"]network-only[`'"]/.test(sw), false)
    assert.match(sw, /addEventListener\(`push`|addEventListener\("push"|addEventListener\('push'/)
    assert.match(sw, /notificationclick/)
    assert.ok(fs.existsSync(path.join(dist, 'offline.html')))
  })
})
