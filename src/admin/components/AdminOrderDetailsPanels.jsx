import { Link } from 'react-router-dom'
import { AuthenticatedApiImage } from './AuthenticatedApiImage.jsx'
import {
  assigneeDisplayLabel,
  assigneeLabel,
  isOrderDeliveryAssignmentLocked,
} from '../../lib/deliveryAssignment.js'
import { deliveryStageLabel, deliveryTimelineSteps } from '../../lib/deliveryStage.js'
import { normalizeOrderStatus } from '../../lib/orderStatus.js'

export function formatInr(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export function displayValue(value) {
  if (value == null || value === '') return 'Not available'
  const s = String(value).trim()
  return s || 'Not available'
}

export function formatPaymentLabel(method) {
  if (method == null || method === '') return null
  const raw = String(method).trim().toLowerCase().replace(/_/g, ' ')
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : null
}

export function formatShippingAddressLines(addr) {
  if (!addr || typeof addr !== 'object') return []
  const lines = []
  if (addr.line1) lines.push(String(addr.line1).trim())
  if (addr.line2) lines.push(String(addr.line2).trim())
  const cityState = [addr.city, addr.state].filter(Boolean).map(String).join(', ')
  if (cityState) lines.push(cityState)
  if (addr.pincode) lines.push(String(addr.pincode).trim())
  if (addr.country && String(addr.country).trim().toUpperCase() !== 'IN') {
    lines.push(String(addr.country).trim())
  }
  if (addr.gstNumber) lines.push(`GST: ${String(addr.gstNumber).trim()}`)
  return lines.filter(Boolean)
}

function DetailField({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist">{label}</p>
      <div className="mt-0.5 text-xs text-[#0f1111] dark:text-fog">{children}</div>
    </div>
  )
}

const STATUS_BADGE_PILL =
  'inline-flex h-6 items-center justify-center rounded-full border px-2.5 text-[11px] font-medium capitalize leading-none'

function orderStatusBadgeClass(status) {
  const s = normalizeOrderStatus(status)
  switch (s) {
    case 'draft':
      return 'border-amber-400/50 bg-amber-500/12 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/18 dark:text-amber-100'
    case 'placed':
    case 'created':
      return 'border-blue-400/50 bg-blue-500/12 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/18 dark:text-blue-100'
    case 'confirmed':
      return 'border-blue-400/50 bg-blue-500/12 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/18 dark:text-blue-100'
    case 'processing':
      return 'border-amber-400/50 bg-amber-500/12 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/18 dark:text-amber-100'
    case 'shipped':
      return 'border-green-400/50 bg-green-500/12 text-green-900 dark:border-green-500/40 dark:bg-green-500/18 dark:text-green-100'
    case 'delivered':
    case 'deliverd':
      return 'border-emerald-400/50 bg-emerald-500/12 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/18 dark:text-emerald-100'
    case 'cancelled':
      return 'border-red-400/50 bg-red-500/12 text-red-900 dark:border-red-500/40 dark:bg-red-500/18 dark:text-red-100'
    case 'refunded':
    case 'refund':
      return 'border-purple-400/50 bg-purple-500/12 text-purple-900 dark:border-purple-500/40 dark:bg-purple-500/18 dark:text-purple-100'
    default:
      return 'border-[#d1d5db] bg-[#f3f4f6] text-[#374151] dark:border-steel/55 dark:bg-steel/25 dark:text-fog'
  }
}

export function OrderStatusBadge({ status }) {
  const label = normalizeOrderStatus(status) || '—'
  return <span className={`${STATUS_BADGE_PILL} ${orderStatusBadgeClass(status)}`}>{label}</span>
}

export function DeliveryTimeline({ order }) {
  const steps = deliveryTimelineSteps(order)
  const failed = String(order?.deliveryStage ?? '').toLowerCase() === 'delivery_failed'

  return (
    <ol className="space-y-2 text-xs">
      {steps.map((step) => {
        const done = Boolean(step.at)
        const isFailStep = failed && step.key === 'delivered'
        return (
          <li key={step.key} className="flex gap-2">
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                isFailStep ? 'bg-red-500' : done ? 'bg-emerald-500' : 'bg-[#d5d9d9]'
              }`}
              aria-hidden
            />
            <span>
              <span className="font-semibold text-[#0f1111] dark:text-fog">{step.label}</span>
              {step.at ? (
                <span className="ml-2 font-mono text-[10px] text-[#565959] dark:text-mist">
                  {formatDateTime(step.at)}
                </span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function lineItemCount(order) {
  const lines = Array.isArray(order?.lines) ? order.lines : []
  return lines.reduce((sum, l) => sum + (Number(l?.quantity) || 0), 0)
}

export const ORDER_VIEW_DETAILS_BTN_CLASS =
  'inline-flex whitespace-nowrap rounded border border-[#d5d9d9] bg-white px-2 py-1 text-[11px] font-normal text-[#0f1111] shadow-[0_1px_2px_rgba(15,17,17,0.08)] hover:bg-[#f7fafa] dark:border-steel/60 dark:bg-slate dark:text-fog dark:hover:bg-steel/30'

/** Link to dedicated admin order details (full payment, address, items, timeline). */
export function OrderViewDetailsLink({ orderId, className = '' }) {
  if (!orderId) return null
  return (
    <Link
      to={`/admin/orders/${encodeURIComponent(String(orderId))}`}
      className={`${ORDER_VIEW_DETAILS_BTN_CLASS} ${className}`.trim()}
    >
      View details
    </Link>
  )
}

function orderSubtotalInr(order) {
  const lines = Array.isArray(order?.lines) ? order.lines : []
  if (lines.length === 0) return null
  return lines.reduce((sum, l) => sum + (Number(l?.lineTotal) || 0), 0)
}

export function OrderTotalsSummary({ order, isDelivery }) {
  if (isDelivery) return null

  const subtotal =
    order?.subtotal != null ? Number(order.subtotal) : orderSubtotalInr(order)
  const grandTotal = order?.total != null ? Number(order.total) : subtotal
  const deliveryCharge = order?.deliveryCharge

  return (
    <div className="border-t border-[#e7e7e7] bg-[#fafafa] px-4 py-3 dark:border-steel/50 dark:bg-ink/10">
      <h3 className="text-xs font-semibold text-[#0f1111] dark:text-fog">Order totals</h3>
      <dl className="mt-2 max-w-sm space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[#565959] dark:text-mist">Subtotal</dt>
          <dd className="tabular-nums font-medium text-[#0f1111] dark:text-fog">
            {subtotal != null ? formatInr(subtotal) : 'Not available'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#565959] dark:text-mist">Delivery charges</dt>
          <dd className="tabular-nums text-[#0f1111] dark:text-fog">
            {deliveryCharge != null ? formatInr(deliveryCharge) : 'Not available'}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-[#e7e7e7] pt-1.5 dark:border-steel/50">
          <dt className="font-semibold text-[#0f1111] dark:text-fog">Grand total</dt>
          <dd className="tabular-nums font-semibold text-[#0f1111] dark:text-fog">
            {grandTotal != null ? formatInr(grandTotal) : 'Not available'}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function OrderDetailsMeta({ order, isDelivery, employeeByEmail }) {
  const addressLines = formatShippingAddressLines(order.shippingAddress)
  const statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : []
  const deliveryLocked = isOrderDeliveryAssignmentLocked(order)
  const assignee = deliveryLocked
    ? assigneeDisplayLabel(order, employeeByEmail)
    : assigneeLabel(order, employeeByEmail)
  const customerProfilePath = order.userId
    ? `/admin/users/${encodeURIComponent(String(order.userId))}`
    : null

  return (
    <div
      className="border-b border-[#e7e7e7] bg-[#fafafa] px-4 py-3 dark:border-steel/50 dark:bg-ink/10"
      role="region"
      aria-label={`Order details for ${order.id}`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-xs font-semibold text-[#0f1111] dark:text-fog">Order details</h3>
        {customerProfilePath ? (
          <Link
            to={customerProfilePath}
            className="font-sans text-[11px] font-semibold text-[#007185] hover:underline dark:text-accent"
          >
            View customer
          </Link>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2 rounded-md border border-[#e7e7e7] bg-white px-3 py-2.5 dark:border-steel/50 dark:bg-slate">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist">
            Customer details
          </p>
          <DetailField label="Name">{displayValue(order.customerName)}</DetailField>
          <DetailField label="Phone">{displayValue(order.customerPhone)}</DetailField>
          <DetailField label="Email">{displayValue(order.customerEmail)}</DetailField>
        </div>
        <div className="space-y-2 rounded-md border border-[#e7e7e7] bg-white px-3 py-2.5 dark:border-steel/50 dark:bg-slate">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist">
            Delivery address
          </p>
          {addressLines.length > 0 ? (
            <address className="space-y-0.5 not-italic text-xs text-[#0f1111] dark:text-fog">
              {addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </address>
          ) : (
            <p className="text-xs text-[#565959] dark:text-mist">Not available</p>
          )}
        </div>
        {!isDelivery ? (
          <div className="space-y-2 rounded-md border border-[#e7e7e7] bg-white px-3 py-2.5 dark:border-steel/50 dark:bg-slate">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist">
              Payment details
            </p>
            <DetailField label="Method">
              {displayValue(formatPaymentLabel(order.paymentMethod) ?? order.paymentMethod)}
            </DetailField>
            <DetailField label="Status">{displayValue(order.paymentStatus)}</DetailField>
            <DetailField label="Amount">{formatInr(order.total)}</DetailField>
            <DetailField label="Paid at">{order.paidAt ? formatDateTime(order.paidAt) : 'Not available'}</DetailField>
          </div>
        ) : null}
        <div className="space-y-2 rounded-md border border-[#e7e7e7] bg-white px-3 py-2.5 dark:border-steel/50 dark:bg-slate">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist">
            Delivery details
          </p>
          <DetailField label="Order status">
            <OrderStatusBadge status={order.status} />
          </DetailField>
          <DetailField label="Delivery stage">{deliveryStageLabel(order.deliveryStage)}</DetailField>
          <DetailField label={deliveryLocked ? 'Delivered by' : 'Assigned to'}>{assignee}</DetailField>
          {isDelivery ? (
            <>
              <DetailField label="Payment status">{displayValue(order.paymentStatus)}</DetailField>
              <DetailField label="Payment method">
                {displayValue(formatPaymentLabel(order.paymentMethod) ?? order.paymentMethod)}
              </DetailField>
            </>
          ) : null}
          <DetailField label="Created">{formatDateTime(order.createdAt)}</DetailField>
          <DetailField label="Assigned at">
            {order.assignedDeliveryAt ? formatDateTime(order.assignedDeliveryAt) : 'Not available'}
          </DetailField>
          <DetailField label="OTP verified at">
            {order.deliveryOtpVerifiedAt
              ? formatDateTime(order.deliveryOtpVerifiedAt)
              : 'Not available'}
          </DetailField>
          <DetailField label="Delivered at">
            {order.deliveryDeliveredAt
              ? formatDateTime(order.deliveryDeliveredAt)
              : order.deliveredAt
                ? formatDateTime(order.deliveredAt)
                : 'Not available'}
          </DetailField>
          {order.deliveryFailedReason ? (
            <DetailField label="Failure reason">
              {order.deliveryFailedReasonLabel || order.deliveryFailedReason}
              {order.deliveryFailedReasonNote ? ` — ${order.deliveryFailedReasonNote}` : ''}
            </DetailField>
          ) : null}
        </div>
        {order.deliveryPartner ? (
          <div className="space-y-2 rounded-md border border-[#e7e7e7] bg-white px-3 py-2.5 dark:border-steel/50 dark:bg-slate">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist">
              Delivery partner
            </p>
            <DetailField label="Name">{displayValue(order.deliveryPartner.name)}</DetailField>
            <DetailField label="Phone">{displayValue(order.deliveryPartner.phone)}</DetailField>
            <DetailField label="Email">{displayValue(order.deliveryPartner.email)}</DetailField>
          </div>
        ) : null}
        {order.assignedDeliveryAdminEmail || order.deliveryStage ? (
          <div className="space-y-2 rounded-md border border-[#e7e7e7] bg-white px-3 py-2.5 sm:col-span-2 dark:border-steel/50 dark:bg-slate">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist">
              Delivery timeline
            </p>
            <DeliveryTimeline order={order} />
            {order.proofPhotoUrl ? (
              <div className="mt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist">
                  Proof of delivery
                </p>
                <AuthenticatedApiImage
                  path={order.proofPhotoUrl}
                  alt="Proof of delivery"
                  className="max-h-48 rounded border border-[#e7e7e7] object-contain dark:border-steel/50"
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {statusHistory.length > 0 ? (
          <div className="space-y-2 rounded-md border border-[#e7e7e7] bg-white px-3 py-2.5 sm:col-span-2 lg:col-span-3 dark:border-steel/50 dark:bg-slate">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist">
              Status timeline
            </p>
            <ol className="max-h-48 space-y-1.5 overflow-y-auto text-xs text-[#0f1111] dark:text-fog">
              {statusHistory.map((ev, idx) => (
                <li key={`${ev.createdAt || idx}-${ev.to}`} className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="font-mono text-[10px] text-[#565959] dark:text-mist">
                    {formatDateTime(ev.createdAt)}
                  </span>
                  <span>
                    {ev.from ? `${ev.from} → ` : ''}
                    <span className="font-semibold">{ev.to || '—'}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function OrderLinesTable({ order, isDelivery }) {
  const lines = Array.isArray(order?.lines) ? order.lines : []

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e7e7e7] bg-[#fafafa] px-4 py-2.5 dark:border-steel/50 dark:bg-ink/10">
        <div>
          <h3 className="text-xs font-semibold text-[#0f1111] dark:text-fog">Order items</h3>
          <p className="mt-0.5 font-mono text-[10px] text-[#565959] dark:text-mist">Order {order.id}</p>
        </div>
        <p className="text-[10px] text-[#565959] dark:text-mist">
          {lines.length} line{lines.length === 1 ? '' : 's'} · {lineItemCount(order)} units
        </p>
      </div>
      {lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[#565959] dark:text-mist">No line items for this order.</p>
      ) : (
        <div className="overflow-x-auto px-2 py-2 sm:px-3">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e7e7e7] text-[11px] font-semibold text-[#565959] dark:border-steel/50 dark:text-mist">
                <th className="px-3 py-2 font-semibold">Product</th>
                <th className="px-3 py-2 font-semibold">SKU</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                {!isDelivery ? (
                  <>
                    <th className="px-3 py-2 text-right font-semibold">Unit price</th>
                    <th className="px-3 py-2 text-right font-semibold">Line total</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7e7e7] dark:divide-steel/40">
              {lines.map((line, i) => (
                <tr key={`${order.id}-line-${line.sku || line.productId || i}`} className="bg-white dark:bg-slate">
                  <td className="px-3 py-2 font-medium text-[#0f1111] dark:text-fog">
                    {line.productName || line.productId || 'Not available'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[#565959] dark:text-mist">
                    {line.sku || 'Not available'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.quantity ?? '—'}</td>
                  {!isDelivery ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">{formatInr(line.unitPrice)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatInr(line.lineTotal)}
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OrderTotalsSummary order={order} isDelivery={isDelivery} />
    </>
  )
}
