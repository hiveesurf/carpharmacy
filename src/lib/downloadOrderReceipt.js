import { formatInr } from '../data/partsCatalog.js'
import {
  isCashOnDeliveryOrder,
  isOrderPaymentPaid,
  isRazorpayOrder,
} from './orderPaymentNormalize.js'
import { formatPaymentStatus } from './orderPaymentStatus.js'

/**
 * Escape PDF literal strings (parentheses / backslash).
 * @param {string} value
 */
function pdfEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * Build a minimal single-page PDF (Helvetica) for an order receipt.
 * No third-party PDF dependency — text-only layout.
 * @param {string[]} lines
 * @returns {Blob}
 */
function buildSimplePdf(lines) {
  const fontSize = 11
  const leading = 16
  const startY = 780
  const contentLines = []
  let y = startY
  for (const line of lines) {
    const safe = pdfEscape(line)
    contentLines.push(`BT /F1 ${fontSize} Tf 48 ${y} Td (${safe}) Tj ET`)
    y -= leading
    if (y < 48) break
  }
  const stream = contentLines.join('\n')
  const streamLen = new TextEncoder().encode(stream).length

  const objects = []
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n')
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n')
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n',
  )
  objects.push(`4 0 obj<< /Length ${streamLen} >>stream\n${stream}\nendstream\nendobj\n`)
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n')

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(new TextEncoder().encode(pdf).length)
    pdf += obj
  }
  const xrefStart = new TextEncoder().encode(pdf).length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefStart}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

function shortOrderId(orderId) {
  const raw = String(orderId || '')
  const stripped = raw.replace(/^ord_/i, '')
  if (stripped.length <= 8) return stripped || raw || '—'
  return stripped.slice(0, 8)
}

function formatReceiptDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function paymentMethodLabel(order) {
  if (isCashOnDeliveryOrder(order)) return 'Cash on delivery'
  if (isRazorpayOrder(order) || String(order?.paymentMethod || '').toLowerCase() === 'upi') {
    return 'Online (UPI/Razorpay)'
  }
  return order?.paymentMethod ? String(order.paymentMethod) : '—'
}

function paymentDetailLine(order) {
  if (isCashOnDeliveryOrder(order)) {
    return isOrderPaymentPaid(order) ? 'Collected on delivery' : 'To be paid on delivery'
  }
  return formatPaymentStatus(order)
}

/**
 * Generate and download a PDF receipt for an order.
 * @param {object | null | undefined} order
 */
export function downloadReceipt(order) {
  if (!order?.id) {
    throw new Error('Order is required to download a receipt')
  }

  const lines = Array.isArray(order.lines) ? order.lines : []
  const rows = [
    'CarPharmacy — Order receipt',
    '================================',
    `Order ID: ${order.id}`,
    `Short ID: ${shortOrderId(order.id)}`,
    `Date: ${formatReceiptDate(order.createdAt || order.placedAt)}`,
    `Status: ${order.status || '—'}`,
    '',
    'Items',
    '--------------------------------',
  ]

  if (lines.length === 0) {
    rows.push('(No line items)')
  } else {
    for (const line of lines) {
      const name = line.productName || 'Product'
      const sku = line.sku ? `SKU ${line.sku}` : 'SKU —'
      const qty = Number(line.quantity ?? 0)
      const unit = Number(line.unitPrice ?? 0)
      const total = Number(line.lineTotal ?? unit * qty)
      rows.push(name)
      rows.push(`  ${sku}  ·  Qty ${qty} x ${formatInr(unit)}  ·  ${formatInr(total)}`)
    }
  }

  rows.push('')
  rows.push('Payment')
  rows.push('--------------------------------')
  rows.push(`Method: ${paymentMethodLabel(order)}`)
  rows.push(`Status: ${paymentDetailLine(order)}`)
  const txn =
    order.paymentTxnId ||
    order.latestPaymentAttempt?.providerPaymentId ||
    order.latestPaymentAttempt?.providerOrderId
  if (txn) rows.push(`Transaction: ${txn}`)

  rows.push('')
  rows.push('Price breakdown')
  rows.push('--------------------------------')
  if (order.subtotal != null) rows.push(`Subtotal: ${formatInr(order.subtotal)}`)
  if (order.total != null) rows.push(`Grand total: ${formatInr(order.total)}`)
  rows.push('')
  rows.push('Thanks for shopping with CarPharmacy')

  const blob = buildSimplePdf(rows)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `CarPharmacy-receipt-${shortOrderId(order.id)}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export { shortOrderId, formatReceiptDate, paymentMethodLabel, paymentDetailLine }
