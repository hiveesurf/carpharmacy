import { getFetchErrorMessage } from './apiErrorMessage.js'

/**
 * Remove a category from the overview list after a successful hard delete.
 * @template {{ id?: string }} T
 * @param {T[]} items
 * @param {string} categoryId
 * @returns {T[]}
 */
export function removeCategoryFromList(items, categoryId) {
  const id = String(categoryId ?? '')
  if (!id) return Array.isArray(items) ? [...items] : []
  return (items || []).filter((row) => String(row?.id ?? '') !== id)
}

/**
 * Prefer a clear in-use message when delete is blocked (409 CATEGORY_IN_USE).
 * @param {unknown} err
 */
export function categoryDeleteErrorMessage(err) {
  const status = /** @type {{ status?: number }} */ (err)?.status
  const payload = /** @type {{ payload?: { error?: { code?: string, message?: string } } }} */ (err)
    ?.payload
  const code = payload?.error?.code
  const apiMessage =
    typeof payload?.error?.message === 'string' ? payload.error.message.trim() : ''

  if (code === 'CATEGORY_IN_USE' || status === 409) {
    if (apiMessage && !/product\(s\) still use this category/i.test(apiMessage)) {
      return apiMessage
    }
    const match = apiMessage.match(/(\d+)\s+product/i)
    const n = match ? Number(match[1]) : null
    if (Number.isFinite(n) && n > 0) {
      return `This category is used by ${n} product${n === 1 ? '' : 's'} and can't be deleted until those are reassigned or removed.`
    }
    return "This category is used by products and can't be deleted until those are reassigned or removed."
  }

  return getFetchErrorMessage(err, 'Could not delete category.')
}
