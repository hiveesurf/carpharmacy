import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/useAuth.js'
import { AdminOverviewPage } from '../../admin/pages/AdminOverviewPage.jsx'
import {
  DELIVERY_HOME_PATH,
  DELIVERY_LIST_PATH,
  deliveryDetailPath,
  deliveryOtpPath,
  deliveryProofPath,
  deliverySuccessPath,
} from '../../lib/deliveryRoutes.js'

/** `/admin` index: delivery partners land on `/delivery`; staff see analytics. */
export function AdminHomeGate() {
  const { sessionRole } = useAuth()
  if (sessionRole === 'delivery') {
    return <Navigate to={DELIVERY_HOME_PATH} replace />
  }
  return <AdminOverviewPage />
}

export function DeliveryLegacyListRedirect() {
  const { sessionRole } = useAuth()
  if (sessionRole === 'delivery') {
    return <Navigate to={DELIVERY_LIST_PATH} replace />
  }
  return <Navigate to="/admin/orders" replace />
}

export function DeliveryLegacyDetailRedirect() {
  const { orderId } = useParams()
  const { sessionRole } = useAuth()
  if (sessionRole === 'delivery') {
    return <Navigate to={deliveryDetailPath(orderId)} replace />
  }
  return <Navigate to={`/admin/orders/${encodeURIComponent(orderId ?? '')}`} replace />
}

export function DeliveryLegacyOtpRedirect() {
  const { orderId } = useParams()
  const { sessionRole } = useAuth()
  if (sessionRole === 'delivery') {
    return <Navigate to={deliveryOtpPath(orderId)} replace />
  }
  return <Navigate to={`/admin/orders/${encodeURIComponent(orderId ?? '')}`} replace />
}

export function DeliveryLegacyProofRedirect() {
  const { orderId } = useParams()
  const { sessionRole } = useAuth()
  if (sessionRole === 'delivery') {
    return <Navigate to={deliveryProofPath(orderId)} replace />
  }
  return <Navigate to={`/admin/orders/${encodeURIComponent(orderId ?? '')}`} replace />
}

export function DeliveryLegacySuccessRedirect() {
  const { orderId } = useParams()
  const { sessionRole } = useAuth()
  if (sessionRole === 'delivery') {
    return <Navigate to={deliverySuccessPath(orderId)} replace />
  }
  return <Navigate to={`/admin/orders/${encodeURIComponent(orderId ?? '')}`} replace />
}
