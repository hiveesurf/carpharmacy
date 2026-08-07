import { buildRevenuePurchasesLinePath } from '../../lib/adminRevenuePurchasesChart.js'

function formatCompactInr(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(n))
}

/**
 * Dual-axis SVG line chart: revenue (₹) + units/items sold.
 *
 * @param {{
 *   rows: { period: string, revenue: number, purchases: number }[],
 *   compact?: boolean,
 * }} props
 */
export function RevenuePurchasesChart({ rows, compact = false }) {
  const width = compact ? 520 : 900
  const height = compact ? 240 : 260
  const padLeft = compact ? 48 : 52
  const padRight = compact ? 36 : 44
  const paddingTop = compact ? 16 : 20
  const paddingBottom = 28
  const chartWidth = width - padLeft - padRight
  const chartHeight = height - paddingTop - paddingBottom

  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue))
  const maxPurchases = Math.max(1, ...rows.map((r) => r.purchases))
  const denom = Math.max(1, rows.length - 1)
  const toX = (i) => padLeft + (chartWidth * i) / denom
  const toYRevenue = (v) => paddingTop + chartHeight - (v / maxRevenue) * chartHeight
  const toYPurchases = (v) => paddingTop + chartHeight - (v / maxPurchases) * chartHeight

  function linePath(getY) {
    return buildRevenuePurchasesLinePath(rows, (row, i) => ({ x: toX(i), y: getY(row) }))
  }

  const revenuePath = linePath((row) => toYRevenue(row.revenue))
  const purchasesPath = linePath((row) => toYPurchases(row.purchases))
  const revenueTicks = [0.25, 0.5, 0.75, 1].map((f) => maxRevenue * f)
  const purchaseTicks = [0.25, 0.5, 0.75, 1].map((f) => maxPurchases * f)
  const lastLabels = rows.length > 6 ? rows.slice(-6) : rows

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-accent">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Revenue
        </span>
        <span className="inline-flex items-center gap-1.5 text-hud">
          <span className="h-2 w-2 rounded-full bg-hud" />
          Items sold
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={compact ? 'w-full max-w-full' : 'min-w-[640px] w-full'}
        >
          {revenueTicks.map((v) => {
            const y = toYRevenue(v)
            return (
              <g key={`rev-${v}`}>
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} className="stroke-steel/35" />
                <text x={padLeft - 6} y={y + 3} textAnchor="end" className="fill-mist text-[10px] font-mono">
                  {formatCompactInr(v)}
                </text>
              </g>
            )
          })}
          {purchaseTicks.map((v) => {
            const y = toYPurchases(v)
            const label = Number.isInteger(v) ? String(v) : v.toFixed(1)
            return (
              <text
                key={`buy-${v}`}
                x={width - padRight + 6}
                y={y + 3}
                textAnchor="start"
                className="fill-hud/80 text-[10px] font-mono"
              >
                {label}
              </text>
            )
          })}
          <line
            x1={padLeft}
            y1={paddingTop + chartHeight}
            x2={width - padRight}
            y2={paddingTop + chartHeight}
            className="stroke-steel/50"
          />
          {revenuePath ? (
            <path d={revenuePath} fill="none" className="stroke-accent" strokeWidth="2.5" />
          ) : null}
          {purchasesPath ? (
            <path d={purchasesPath} fill="none" className="stroke-hud" strokeWidth="2.5" />
          ) : null}
          {rows.map((row, i) => (
            <g key={`pt-${row.period}`}>
              <circle
                cx={toX(i)}
                cy={toYRevenue(row.revenue)}
                r={4}
                className="fill-accent stroke-slate"
                strokeWidth="1.5"
              />
              <circle
                cx={toX(i)}
                cy={toYPurchases(row.purchases)}
                r={4}
                className="fill-hud stroke-slate"
                strokeWidth="1.5"
              />
            </g>
          ))}
          {lastLabels.map((row, idx) => {
            const originalIndex = rows.length > 6 ? rows.length - 6 + idx : idx
            return (
              <text
                key={row.period}
                x={toX(originalIndex)}
                y={height - 8}
                textAnchor="middle"
                className="fill-mist text-[10px] font-mono"
              >
                {row.period}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
