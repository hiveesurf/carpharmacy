/* eslint-disable no-restricted-globals */
/// <reference lib="webworker" />
/**
 * registerRoute order (first match wins in Workbox):
 * 1. StaleWhileRevalidate — public catalog APIs only (matcher uses workboxRuntimeStrategy)
 * 2. CacheFirst — product/static images only
 * 3. NavigationRoute — storefront SPA navigations (denylist: /admin, /delivery, /api)
 *
 * Sensitive API / Authorization / admin / delivery requests intentionally have
 * NO matching route (workboxRuntimeStrategy → null). They are not registered
 * under NetworkOnly either — NetworkOnly still shows Size: (ServiceWorker) in
 * DevTools because the SW intercepts the fetch. True exclusion = no route.
 */
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing'
import { CacheFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import {
  shouldOfferOfflineFallback,
  workboxRuntimeStrategy,
} from './lib/pwaCachePolicy.js'
import { buildPushNotification, resolveNotificationClickUrl } from './lib/pwaPushHandlers.js'

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

const networkOnly = new NetworkOnly()

// (1) Public catalog — SWR. Matcher returns false for bypass/sensitive/auth.
registerRoute(({ request, url }) => {
  return (
    workboxRuntimeStrategy({
      url,
      method: request.method,
      headers: request.headers,
      destination: request.destination,
      mode: request.mode,
    }) === 'stale-while-revalidate'
  )
}, new StaleWhileRevalidate({
  cacheName: 'carpharmacy-public-api',
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 60 * 60 }),
  ],
}))

// (2) Images — cache-first.
registerRoute(({ request, url }) => {
  return (
    workboxRuntimeStrategy({
      url,
      method: request.method,
      headers: request.headers,
      destination: request.destination,
    }) === 'cache-first'
  )
}, new CacheFirst({
  cacheName: 'carpharmacy-images',
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({
      maxEntries: 200,
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  ],
}))

const appShellHandler = createHandlerBoundToURL('/index.html')
const navigationHandler = async (params) => {
  const url = new URL(params.request.url)
  if (!shouldOfferOfflineFallback(url)) {
    return networkOnly.handle(params)
  }
  try {
    return await appShellHandler(params)
  } catch {
    const offline = await caches.match('/offline.html')
    if (offline) return offline
    throw new Error('offline')
  }
}

// (3) Storefront navigations only — admin/delivery/api denylisted (no SW nav handling).
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/admin(?:\/|$)/, /^\/delivery(?:\/|$)/, /^\/api(?:\/|$)/],
  }),
)

setCatchHandler(async ({ request }) => {
  if (request?.destination === 'document' || request?.mode === 'navigate') {
    if (shouldOfferOfflineFallback(request.url)) {
      const offline = await caches.match('/offline.html')
      if (offline) return offline
    }
  }
  return Response.error()
})

self.addEventListener('push', (event) => {
  const { title, options } = buildPushNotification(event.data)
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = resolveNotificationClickUrl(event.notification)
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client && target) {
            try {
              await client.navigate(target)
              return
            } catch {
              /* fall through to openWindow */
            }
          }
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target)
      }
    })(),
  )
})
