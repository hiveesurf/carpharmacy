/**
 * Helpers for the admin "Revenue vs items sold" SVG line chart.
 * Custom SVG — not recharts/chart.js.
 */

/**
 * @param {unknown} rows
 * @returns {{ period: string, revenue: number, purchases: number }[]}
 */
export function normalizeChartRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => ({
      period: String(r?.period ?? ''),
      revenue: Number(r?.revenue ?? 0),
      purchases: Number(r?.purchases ?? 0),
    }))
    .filter((r) => r.period)
}

/**
 * Build an SVG path for a polyline. Returns null when there are fewer than 2 points
 * (a lone M command paints nothing — markers are drawn separately).
 *
 * @param {{ period: string, revenue: number, purchases: number }[]} rows
 * @param {(row: { revenue: number, purchases: number }, index: number) => { x: number, y: number }} pointAt
 * @returns {string | null}
 */
export function buildRevenuePurchasesLinePath(rows, pointAt) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length < 2) return null
  return list
    .map((row, i) => {
      const { x, y } = pointAt(row, i)
      return `${i === 0 ? 'M' : 'L'} ${Number(x).toFixed(2)} ${Number(y).toFixed(2)}`
    })
    .join(' ')
}
