/**
 * Pure helpers for push + notification-click handling (shared by SW + tests).
 */

/**
 * @param {PushMessageData | null | undefined} data
 * @returns {{ title: string, options: NotificationOptions }}
 */
export function buildPushNotification(data) {
  let payload = {}
  try {
    payload = data ? data.json() : {}
  } catch {
    payload = {}
  }
  const title = payload.title || 'Notification'
  const options = {
    body: payload.body || '',
    data: payload.data || {},
    icon: '/logo-carnalysys.png',
    badge: '/logo-carnalysys.png',
  }
  return { title, options }
}

/**
 * @param {{ data?: { url?: string } } | null | undefined} notification
 * @returns {string}
 */
export function resolveNotificationClickUrl(notification) {
  const target = notification?.data?.url
  if (typeof target === 'string' && target.trim()) return target.trim()
  return '/'
}
