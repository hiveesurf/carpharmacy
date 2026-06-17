/**
 * Thin wrapper around the guided delivery workflow (admin table fallback only).
 */
import { useCallback, useState } from 'react'
import { DeliveryWorkflowScreen } from './delivery/DeliveryWorkflowScreen.jsx'

export function DeliveryOrderActions({ order, busyId, onBusy, onUpdated, onError }) {
  const [localError, setLocalError] = useState(null)
  const handleError = useCallback(
    (msg) => {
      setLocalError(msg)
      onError?.(msg)
    },
    [onError],
  )

  if (!order) return null
  return (
    <DeliveryWorkflowScreen
      order={order}
      busyId={busyId}
      onBusy={onBusy}
      onUpdated={onUpdated}
      error={localError}
      onError={handleError}
      listPath="/admin/orders"
    />
  )
}
