/**
 * Registers against the single Workbox PWA service worker (not a separate /sw-push.js).
 */
export async function registerPushServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  // useRegisterSW registers the Workbox SW; wait for it rather than registering a second script.
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('App service worker is not ready yet.')), 8_000)
    }),
  ])
  return ready
}

export async function requestPushSubscription() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('Push notifications are not supported on this browser.')
  }
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    throw new Error('Push is not configured yet (missing VITE_VAPID_PUBLIC_KEY).')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Push permission was not granted.')
  }
  const reg = await registerPushServiceWorker()
  if (!reg) {
    throw new Error('Unable to register push service worker.')
  }
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing.toJSON()
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64ToUint8Array(vapidPublicKey),
  })
  return sub.toJSON()
}

function base64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}
