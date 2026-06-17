import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, ChevronRight } from 'lucide-react'
import { useDeliveryOrder } from '../../hooks/useDeliveryOrder.js'
import { useDeliveryWorkflow } from '../../hooks/useDeliveryWorkflow.js'
import { DeliveryContactActions } from '../../components/delivery/DeliveryContactActions.jsx'
import { DeliveryCustomerSummary } from '../../components/delivery/DeliveryCustomerSummary.jsx'
import { DeliveryPartnerProgressTimeline } from '../../components/delivery/DeliveryPartnerProgressTimeline.jsx'
import { DeliveryStageBadge } from '../../components/delivery/DeliveryStageBadge.jsx'
import { DeliveryPaymentSummary } from '../../components/delivery/DeliveryPaymentDisplay.jsx'
import { DeliveryCodConfirmDialog } from '../../components/delivery/DeliveryCodConfirmDialog.jsx'
import { resolveDeliveryPaymentView } from '../../../lib/deliveryPayment.js'
import {
  DeliveryPageError,
  DeliveryPageLoading,
  DeliveryPageShell,
  DeliveryPanelSection,
} from '../../components/delivery/DeliveryPageShell.jsx'
import {
  DELIVERY_LIST_PATH,
  deliveryOtpPath,
  deliveryProofPath,
  deliverySuccessPath,
} from '../../../lib/deliveryRoutes.js'
import { DELIVERY_FAILED_REASONS } from '../../../lib/deliveryStage.js'
import {
  DELIVERY_INPUT_FOCUS,
  DELIVERY_LABEL,
  DELIVERY_LINK,
  DELIVERY_OUTLINE_DANGER_BTN,
  DELIVERY_PRIMARY_BTN,
  DELIVERY_PRIMARY_BTN_INLINE,
} from '../../components/delivery/deliveryTheme.js'

export function DeliveryDetailsPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { order, setOrder, loading, error } = useDeliveryOrder(orderId)
  const [actionError, setActionError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [codConfirmOpen, setCodConfirmOpen] = useState(false)

  const paymentView = useMemo(() => resolveDeliveryPaymentView(order), [order])

  const workflow = useDeliveryWorkflow({
    order,
    onUpdated: setOrder,
    onError: setActionError,
    onBusy: setBusyId,
    busyId,
  })

  const {
    uiStage,
    busy,
    run,
    confirmReached,
    tel,
    wa,
    maps,
    showFailForm,
    setShowFailForm,
    failReason,
    setFailReason,
    failNote,
    setFailNote,
  } = workflow

  useEffect(() => {
    if (uiStage === 'delivered' && orderId) {
      navigate(deliverySuccessPath(orderId), { replace: true })
    }
  }, [uiStage, orderId, navigate])

  const customerName = order?.customerName?.trim() || 'Customer'

  const canReportIssue = ['out_for_delivery', 'otp_pending', 'proof', 'accepted'].includes(uiStage)
  const showMarkDelivered = uiStage === 'ready_deliver'

  const workflowAction = useMemo(() => {
    if (uiStage === 'assigned') {
      return { type: 'button', label: 'Accept assignment', onClick: () => void run('accept') }
    }
    if (uiStage === 'accepted') {
      return { type: 'button', label: 'Start delivery', onClick: () => void run('out') }
    }
    if (uiStage === 'out_for_delivery') {
      return { type: 'button', label: 'I have reached', onClick: confirmReached }
    }
    if (uiStage === 'otp_pending') {
      return {
        type: 'nav',
        label: 'Verify OTP',
        hint: 'Enter the 6-digit code from the customer.',
        onClick: () => navigate(deliveryOtpPath(orderId)),
      }
    }
    if (uiStage === 'proof') {
      return {
        type: 'nav',
        label: 'Upload proof',
        title: 'Upload delivery proof',
        hint: 'Take a photo at the doorstep. You will not see the image after upload.',
        onClick: () => navigate(deliveryProofPath(orderId)),
      }
    }
    if (uiStage === 'ready_deliver') {
      return {
        type: 'info',
        title: 'Ready to complete',
        hint: 'OTP verified and proof uploaded. Mark the order as delivered below.',
      }
    }
    return null
  }, [uiStage, orderId, navigate, run, confirmReached])

  if (loading) return <DeliveryPageLoading />
  if (error) return <DeliveryPageError message={error} />
  if (!order) return <DeliveryPageError message="Order not found." />

  if (uiStage === 'failed') {
    return (
      <DeliveryPageShell>
        <Link to={DELIVERY_LIST_PATH} className={`${DELIVERY_LINK} mb-1`}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to deliveries
        </Link>
        <p className="text-center text-sm font-semibold text-red-800">Delivery marked as failed</p>
        {order.deliveryFailedReasonLabel ? (
          <p className="mt-1 text-center text-sm text-[#565959]">{order.deliveryFailedReasonLabel}</p>
        ) : null}
        <Link to={DELIVERY_LIST_PATH} className={`${DELIVERY_PRIMARY_BTN} mt-4`}>
          Back to deliveries
        </Link>
      </DeliveryPageShell>
    )
  }

  return (
    <DeliveryPageShell>
      <header className="flex items-start justify-between gap-3 border-b border-[#e7e7e7] pb-2.5">
        <div className="min-w-0">
          <Link to={DELIVERY_LIST_PATH} className={DELIVERY_LINK}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to deliveries
          </Link>
          <p className={`${DELIVERY_LABEL} mt-2`}>Order ID</p>
          <h1 className="truncate font-mono text-base font-semibold text-[#0f1111]">{order.id}</h1>
        </div>
        <DeliveryStageBadge uiStage={uiStage} reached={workflow.reached} />
      </header>

      {actionError ? (
        <div
          className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {actionError}
        </div>
      ) : null}

      <DeliveryPanelSection>
        <DeliveryCustomerSummary order={order} customerName={customerName} />
      </DeliveryPanelSection>

      <DeliveryPanelSection className="!py-2">
        <DeliveryContactActions tel={tel} wa={wa} maps={maps} labels="full" />
      </DeliveryPanelSection>

      <DeliveryPanelSection className="!py-2.5">
        <p className={`${DELIVERY_LABEL} mb-2`}>Delivery progress</p>
        <DeliveryPartnerProgressTimeline order={order} uiStage={uiStage} />
      </DeliveryPanelSection>

      <DeliveryPanelSection>
        <DeliveryPaymentSummary order={order} />
      </DeliveryPanelSection>

      {workflowAction ? (
        <DeliveryPanelSection>
          {workflowAction.title ? (
            <p className="text-sm font-semibold text-[#0f1111]">{workflowAction.title}</p>
          ) : null}
          {workflowAction.hint ? (
            <p className={`text-xs text-[#565959] ${workflowAction.title ? 'mt-1' : ''}`}>{workflowAction.hint}</p>
          ) : null}
          {workflowAction.type === 'button' || workflowAction.type === 'nav' ? (
            <button
              type="button"
              className={`${DELIVERY_PRIMARY_BTN} mt-3 max-w-md`}
              disabled={busy}
              onClick={workflowAction.onClick}
            >
              {busy ? 'Please wait…' : workflowAction.label}
              {workflowAction.type === 'nav' ? (
                <ChevronRight className="h-5 w-5" aria-hidden />
              ) : null}
            </button>
          ) : null}
        </DeliveryPanelSection>
      ) : null}

      {(showMarkDelivered || canReportIssue) && !showFailForm ? (
        <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row sm:max-w-none">
          {showMarkDelivered ? (
            <button
              type="button"
              className={DELIVERY_PRIMARY_BTN_INLINE}
              disabled={busy}
              onClick={() => {
                if (paymentView.requiresCashConfirmation) {
                  setCodConfirmOpen(true)
                  return
                }
                void run('delivered')
              }}
            >
              {busy ? 'Completing…' : 'Mark as delivered'}
            </button>
          ) : null}
          {canReportIssue ? (
            <button
              type="button"
              className={DELIVERY_OUTLINE_DANGER_BTN}
              disabled={busy}
              onClick={() => setShowFailForm(true)}
            >
              Report issue
            </button>
          ) : null}
        </div>
      ) : null}

      {showFailForm ? (
        <DeliveryPanelSection className="border-red-200 bg-red-50/50">
          <p className="text-sm font-semibold text-red-800">Report delivery issue</p>
          <div className="mt-2 space-y-2">
            <select
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              className={`h-10 w-full rounded-lg border border-[#d5d9d9] bg-white px-3 text-sm ${DELIVERY_INPUT_FOCUS}`}
            >
              {DELIVERY_FAILED_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {failReason === 'other' ? (
              <input
                type="text"
                value={failNote}
                onChange={(e) => setFailNote(e.target.value)}
                placeholder="Describe the issue"
                className={`h-10 w-full rounded-lg border border-[#d5d9d9] bg-white px-3 text-sm ${DELIVERY_INPUT_FOCUS}`}
              />
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className={DELIVERY_OUTLINE_DANGER_BTN} disabled={busy} onClick={() => void run('failed')}>
                Submit report
              </button>
              <button
                type="button"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-[#d5d9d9] bg-white text-sm font-semibold text-[#565959] hover:bg-[#f7fafa]"
                onClick={() => setShowFailForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </DeliveryPanelSection>
      ) : null}

      <DeliveryCodConfirmDialog
        open={codConfirmOpen}
        order={order}
        busy={busy}
        onCancel={() => setCodConfirmOpen(false)}
        onConfirm={() => {
          setCodConfirmOpen(false)
          void run('delivered')
        }}
      />
    </DeliveryPageShell>
  )
}
