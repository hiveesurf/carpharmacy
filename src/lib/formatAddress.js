/** @param {Record<string, unknown> | null | undefined} a */
export function formatAddressBlock(a) {
  if (!a) return ''
  const parts = [
    [a.line1, a.line2].filter(Boolean).join(', '),
    [a.city, a.state, a.pincode].filter(Boolean).join(', '),
    a.country,
    a.gstNumber ? `GST: ${a.gstNumber}` : null,
  ].filter(Boolean)
  return parts.join('\n')
}

/** @param {Record<string, unknown> | null | undefined} a */
export function formatAddressOneLine(a) {
  return formatAddressBlock(a).replace(/\n/g, ', ')
}
