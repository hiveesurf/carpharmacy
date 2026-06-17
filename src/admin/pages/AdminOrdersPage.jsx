import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { OrderViewDetailsLink } from '../components/AdminOrderDetailsPanels.jsx'
import { DeliveryOrderActions } from '../components/DeliveryOrderActions.jsx'
import { deliveryStageLabel } from '../../lib/deliveryStage.js'
import {
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
  XCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Inbox,
  Download,
  ChevronDown,
} from 'lucide-react'
import * as adminService from '../../services/adminService.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import {
  buildOrderSummaryCounts,
  matchesStatusTab,
  normalizeOrderStatus,
  ORDER_STATUSES,
  ORDER_STATUS_FILTERS,
} from '../../lib/orderStatus.js'
import { resolveApiAssetUrl } from '../../lib/resolveApiAssetUrl.js'
import { useAuth } from '../../context/useAuth.js'
import { DELIVERY_LIST_PATH } from '../../lib/deliveryRoutes.js'
import {
  employeeAvailabilityShortLabel,
  isEmployeeOnlineForAssignment,
} from '../../lib/employeeAvailability.js'
import {
  assigneeDisplayLabel,
  assigneeLabel,
  assigneeLabelForExport,
  isOrderDeliveryAssignmentLocked,
} from '../../lib/deliveryAssignment.js'

const STATUSES = ORDER_STATUSES

const PAGE_SIZE = 5
const PHONE_SEARCH_DEBOUNCE_MS = 350

const canvasClass =
  '-mx-4 min-w-0 rounded-none bg-[#eaeded] px-4 py-5 dark:bg-ink/40 md:-mx-6 md:rounded-xl md:px-6 lg:-mx-0 lg:rounded-xl lg:px-8'

const AMAZON_TEAL_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#007185] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#005f6b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007185]/40 disabled:opacity-50'

const TABLE_TH =
  'px-3 py-2 align-middle text-left text-[11px] font-semibold text-[#565959] dark:text-mist lg:px-4'
const TABLE_CELL = 'px-3 py-2 align-middle text-left text-[13px] text-[#0f1111] dark:text-fog lg:px-4'
const TABLE_CELL_META = 'px-3 py-2 align-middle text-left text-[13px] text-[#565959] dark:text-mist lg:px-4'
const TABLE_ROW = 'h-11 transition-colors hover:bg-[#f7fafa] dark:hover:bg-steel/15'

const FILTER_FIELD_LABEL = 'mb-1 block text-xs font-normal text-[#565959] dark:text-mist'
const FILTER_INPUT =
  'h-10 w-full min-w-0 rounded-md border border-[#888c8c] bg-white px-3 text-sm text-[#0f1111] outline-none focus:border-[#007185] focus:ring-1 focus:ring-[#007185]/30 dark:border-steel/60 dark:bg-slate dark:text-fog'
const FILTER_SELECT = `${FILTER_INPUT} appearance-none pr-10`
const TOOLBAR_BTN =
  'inline-flex h-10 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[#888c8c] bg-white px-3 text-sm font-normal text-[#0f1111] hover:bg-[#f7fafa] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007185]/30 dark:border-steel/60 dark:bg-slate dark:text-fog dark:hover:bg-steel/30'

const TOOLBAR_BTN_EXPORT = `${TOOLBAR_BTN} px-4`

const FILTER_TOOLBAR_ROW =
  'flex w-full min-w-0 flex-wrap items-end gap-3 lg:flex-nowrap'

function FilterSelect({ id, value, onChange, className = '', children }) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={onChange} className={`${FILTER_SELECT} ${className}`.trim()}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-mist"
        aria-hidden
      />
    </div>
  )
}

const DATE_RANGE_OPTIONS = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'custom', label: 'Custom range' },
]

const ROW_SELECT_CLASS =
  'h-8 w-full max-w-full min-w-0 truncate rounded-md border border-[#d5d9d9] bg-white px-2 text-[11px] text-[#0f1111] outline-none focus:border-[#007185] focus:ring-1 focus:ring-[#007185]/30 dark:border-steel/60 dark:bg-slate dark:text-fog'

function formatInr(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function parseOrderDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function toDateInputValue(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function presetToRange(preset) {
  const now = new Date()
  const end = toDateInputValue(now)
  if (preset === 'all') return { from: '', to: '' }
  if (preset === 'today') return { from: end, to: end }
  const days = preset === '7' ? 7 : preset === '30' ? 30 : preset === '90' ? 90 : 0
  if (days > 0) {
    const fromDate = new Date(now)
    fromDate.setDate(fromDate.getDate() - (days - 1))
    return { from: toDateInputValue(fromDate), to: end }
  }
  return { from: '', to: '' }
}

function matchesDateRange(order, preset, customFrom, customTo) {
  if (preset === 'all') return true
  const created = parseOrderDate(order?.createdAt)
  if (!created) return false

  let from = null
  let to = endOfDay(new Date())

  if (preset === 'custom') {
    if (!customFrom && !customTo) return true
    if (customFrom) from = startOfDay(new Date(`${customFrom}T00:00:00`))
    if (customTo) to = endOfDay(new Date(`${customTo}T00:00:00`))
  } else {
    const range = presetToRange(preset)
    if (range.from) from = startOfDay(new Date(`${range.from}T00:00:00`))
    if (range.to) to = endOfDay(new Date(`${range.to}T00:00:00`))
  }

  if (from && created < from) return false
  if (to && created > to) return false
  return true
}

function looksLikePhoneQuery(q) {
  const t = q.trim()
  if (t.length < 6) return false
  const digits = t.replace(/\D/g, '')
  return digits.length >= 6 && /^[\d\s+\-()]+$/.test(t)
}

function escapeCsvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function exportOrdersToCsv(orders, employeeByEmail, isDelivery) {
  const headers = ['Order ID', 'Customer', 'Phone', 'Status', 'Assigned', 'Amount', 'Items', 'Created']
  const lines = [
    headers.join(','),
    ...orders.map((o) =>
      [
        o.id,
        o.customerName?.trim() || 'Customer',
        o.customerPhone || '',
        normalizeOrderStatus(o.status),
        assigneeLabel(o, employeeByEmail),
        isDelivery ? '' : o.total ?? '',
        lineItemCount(o),
        o.createdAt || '',
      ]
        .map(escapeCsvCell)
        .join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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

function OrderStatusBadge({ status }) {
  const label = normalizeOrderStatus(status) || '—'
  return <span className={`${STATUS_BADGE_PILL} ${orderStatusBadgeClass(status)}`}>{label}</span>
}

function DeliveredAssigneeReadonly({ order, employeeByEmail }) {
  const name = assigneeLabel(order, employeeByEmail)
  if (name === 'Unassigned') {
    return <span className="text-[12px] italic text-[#565959] dark:text-mist">Unassigned</span>
  }
  return (
    <span
      className="text-[13px] leading-snug text-[#0f1111] dark:text-fog"
      title="Delivery partner cannot be changed after delivery"
    >
      {name}
      <span className="font-semibold text-emerald-700 dark:text-emerald-400"> — Delivered</span>
    </span>
  )
}

function AssignedDeliveryCell({
  order,
  isSuperAdmin,
  deliveryEmployees,
  employeeByEmail,
  employeesLoaded,
  busyId,
  onAssign,
}) {
  const label = assigneeLabel(order, employeeByEmail)
  const assignmentLocked = isOrderDeliveryAssignmentLocked(order)

  if (!isSuperAdmin) {
    return (
      <span
        className={
          order.assignedDeliveryAdminEmail
            ? 'text-[13px] text-[#0f1111] dark:text-fog'
            : 'text-[13px] italic text-[#565959] dark:text-mist'
        }
      >
        {assignmentLocked ? assigneeDisplayLabel(order, employeeByEmail) : label}
      </span>
    )
  }

  if (!employeesLoaded) {
    return <span className="inline-block min-h-8 w-full text-[12px] text-[#565959] dark:text-mist"> </span>
  }

  if (assignmentLocked) {
    return <DeliveredAssigneeReadonly order={order} employeeByEmail={employeeByEmail} />
  }

  const anyOnline = deliveryEmployees.some((d) => isEmployeeOnlineForAssignment(d?.availability))
  const options = deliveryEmployees.filter(
    (d) =>
      isEmployeeOnlineForAssignment(d?.availability) ||
      d.email === order.assignedDeliveryAdminEmail,
  )

  if (!anyOnline && !order.assignedDeliveryAdminEmail) {
    return (
      <span className="text-[12px] italic leading-snug text-[#565959] dark:text-mist">
        No online delivery available
      </span>
    )
  }

  return (
    <select
      value={order.assignedDeliveryAdminEmail || ''}
      disabled={busyId === order.id}
      onChange={(e) => onAssign(order.id, e.target.value)}
      className={ROW_SELECT_CLASS}
      aria-label={`Assign delivery for order ${order.id}`}
    >
      <option value="">Unassigned</option>
      {options.map((d) => (
        <option key={d.email} value={d.email}>
          {(d.name || d.email) + ` (${employeeAvailabilityShortLabel(d.availability)})`}
        </option>
      ))}
    </select>
  )
}

function lineItemCount(order) {
  const lines = Array.isArray(order?.lines) ? order.lines : []
  return lines.reduce((sum, l) => sum + (Number(l?.quantity) || 0), 0)
}

function OrderStatusCell({ order, isDelivery, busyId, onChangeStatus }) {
  if (isDelivery) {
    return (
      <div className="space-y-1">
        <OrderStatusBadge status={order.status} />
        <p className="text-[10px] capitalize text-[#565959] dark:text-mist">
          {deliveryStageLabel(order.deliveryStage)}
        </p>
        {order.paymentStatus ? (
          <p className="text-[10px] text-[#565959] dark:text-mist">Pay: {order.paymentStatus}</p>
        ) : null}
      </div>
    )
  }
  return (
    <select
      value={order.status ?? ''}
      disabled={busyId === order.id}
      onChange={(e) => onChangeStatus(order, e.target.value)}
      className={ROW_SELECT_CLASS}
      aria-label={`Update status for order ${order.id}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  )
}

function OrderSummaryCard({ label, value, icon: Icon, iconBg, iconColor }) {
  return (
    <div className="flex min-h-[5.25rem] flex-col rounded-lg border border-[#d5d9d9] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,17,17,0.07)] dark:border-steel/60 dark:bg-slate">
      <div
        className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}
        aria-hidden
      >
        {Icon ? <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={2} /> : null}
      </div>
      <p className="font-sans text-xl font-semibold tabular-nums leading-none tracking-tight text-[#0f1111] dark:text-fog">
        {value ?? 0}
      </p>
      <p className="mt-1 text-[11px] leading-tight text-[#565959] dark:text-mist">{label}</p>
    </div>
  )
}

function OrdersEmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f3f4f6] dark:bg-steel/25"
        aria-hidden
      >
        <Inbox className="h-7 w-7 text-[#aab7b8] dark:text-mist" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-base font-medium text-[#0f1111] dark:text-fog">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#565959] dark:text-mist">{description}</p>
      ) : null}
    </div>
  )
}

const ACTION_BTN_CLASS =
  'whitespace-nowrap rounded border border-[#d5d9d9] bg-white px-2 py-1 text-[11px] font-normal text-[#0f1111] shadow-[0_1px_2px_rgba(15,17,17,0.08)] hover:bg-[#f7fafa] dark:border-steel/60 dark:bg-slate dark:text-fog dark:hover:bg-steel/30'

function OrderActionsCell({ order, isDelivery, busyId, onBusy, onOrderUpdated, onActionError }) {
  if (isDelivery) {
    return (
      <DeliveryOrderActions
        order={order}
        busyId={busyId}
        onBusy={onBusy}
        onUpdated={onOrderUpdated}
        onError={onActionError}
        compact
      />
    )
  }

  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <OrderViewDetailsLink orderId={order.id} />
    </div>
  )
}

export function AdminOrdersPage() {
  const { sessionRole } = useAuth()
  const isDelivery = sessionRole === 'delivery'
  const isSuperAdmin = sessionRole === 'super_admin'
  const [items, setItems] = useState([])
  const [summaryOrders, setSummaryOrders] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [deliveryEmployees, setDeliveryEmployees] = useState([])
  const [deliveryEmployeesLoaded, setDeliveryEmployeesLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [phoneForApi, setPhoneForApi] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [dateRangePreset, setDateRangePreset] = useState('all')
  const [dateRangeFrom, setDateRangeFrom] = useState('')
  const [dateRangeTo, setDateRangeTo] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [nextPage, setNextPage] = useState(1)
  const [deliveryMonth, setDeliveryMonth] = useState('')
  const [deliveryFrom, setDeliveryFrom] = useState('')
  const [deliveryTo, setDeliveryTo] = useState('')

  useEffect(() => {
    if (isDelivery) return
    const id = window.setTimeout(() => {
      const t = searchInput.trim()
      setPhoneForApi(looksLikePhoneQuery(t) ? t.replace(/\D/g, '') : '')
    }, PHONE_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [searchInput, isDelivery])

  useEffect(() => {
    if (!isDelivery) return
    if (dateRangePreset === 'custom') return
    if (dateRangePreset === 'all') {
      setDeliveryFrom('')
      setDeliveryTo('')
      setDeliveryMonth('')
      return
    }
    const { from, to } = presetToRange(dateRangePreset)
    setDeliveryFrom(from)
    setDeliveryTo(to)
    setDeliveryMonth('')
  }, [dateRangePreset, isDelivery])

  const employeeByEmail = useMemo(() => {
    const map = new Map()
    for (const e of deliveryEmployees) {
      if (e?.email) map.set(String(e.email).toLowerCase(), e)
    }
    return map
  }, [deliveryEmployees])

  const loadSummary = useCallback(async () => {
    if (isDelivery) return
    setSummaryLoading(true)
    try {
      const all = await adminService.listAllOrdersForSummary()
      setSummaryOrders(all)
    } catch {
      setSummaryOrders([])
    } finally {
      setSummaryLoading(false)
    }
  }, [isDelivery])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isDelivery) {
        const q = {}
        const mo = deliveryMonth.trim()
        const df = deliveryFrom.trim()
        const dt = deliveryTo.trim()
        if (mo) q.month = mo
        if (df) q.from = df
        if (dt) q.to = dt
        const list = await adminService.listDeliveryOrders(q)
        setItems(list)
        setHasMore(false)
        setNextPage(1)
      } else {
        const result = await adminService.listOrders({
          page: 0,
          size: PAGE_SIZE,
          phone: phoneForApi || undefined,
        })
        setItems(result.items || [])
        setHasMore(Boolean(result.hasMore))
        setNextPage(Number.isFinite(result.nextPage) ? result.nextPage : 1)
        void loadSummary()
      }
    } catch (e) {
      setError(getFetchErrorMessage(e))
      setItems([])
      setHasMore(false)
      setNextPage(1)
    } finally {
      setLoading(false)
    }
  }, [isDelivery, phoneForApi, deliveryMonth, deliveryFrom, deliveryTo, loadSummary])

  const loadMore = useCallback(async () => {
    if (isDelivery || loadingMore || !hasMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const result = await adminService.listOrders({
        page: nextPage,
        size: PAGE_SIZE,
        phone: phoneForApi || undefined,
      })
      setItems((prev) => [...prev, ...(result.items || [])])
      setHasMore(Boolean(result.hasMore))
      setNextPage(Number.isFinite(result.nextPage) ? result.nextPage : nextPage + 1)
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }, [isDelivery, loadingMore, hasMore, nextPage, phoneForApi])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!isSuperAdmin) {
      setDeliveryEmployeesLoaded(true)
      return
    }
    setDeliveryEmployeesLoaded(false)
    ;(async () => {
      try {
        const list = await adminService.listEmployees()
        setDeliveryEmployees(
          (Array.isArray(list) ? list : []).filter(
            (e) => String(e?.role || '').toLowerCase() === 'delivery',
          ),
        )
      } catch {
        setDeliveryEmployees([])
      } finally {
        setDeliveryEmployeesLoaded(true)
      }
    })()
  }, [isSuperAdmin])

  useEffect(() => {
    ;(async () => {
      try {
        const list = await adminService.listUsers()
        setUsers(Array.isArray(list) ? list : [])
      } catch {
        setUsers([])
      }
    })()
  }, [])

  const normalizedSearch = searchInput.trim().toLowerCase()

  const suggestions = useMemo(() => {
    if (!normalizedSearch || selectedUserId) return []
    return users
      .filter((u) => {
        const id = String(u?.id || '').toLowerCase()
        const name = String(u?.name || '').toLowerCase()
        return id.includes(normalizedSearch) || name.includes(normalizedSearch)
      })
      .slice(0, 8)
  }, [users, normalizedSearch, selectedUserId])

  const filteredItems = useMemo(() => {
    const matchesSearch = (o) => {
      if (selectedUserId) return String(o?.userId || '') === selectedUserId
      if (!normalizedSearch) return true
      const q = normalizedSearch
      const orderUserId = String(o?.userId || '').toLowerCase()
      const orderUserName = String(o?.customerName || '').toLowerCase()
      const orderId = String(o?.id || '').toLowerCase()
      const phone = String(o?.customerPhone || '').toLowerCase()
      return (
        orderUserId.includes(q) ||
        orderUserName.includes(q) ||
        orderId.includes(q) ||
        phone.includes(q)
      )
    }

    return items.filter((o) => {
      if (!matchesSearch(o)) return false
      if (statusFilter !== 'all' && !matchesStatusTab(o?.status, statusFilter)) return false
      if (
        !matchesDateRange(
          o,
          dateRangePreset,
          isDelivery ? deliveryFrom : dateRangeFrom,
          isDelivery ? deliveryTo : dateRangeTo,
        )
      ) {
        return false
      }
      return true
    })
  }, [
    items,
    statusFilter,
    normalizedSearch,
    selectedUserId,
    isDelivery,
    dateRangePreset,
    dateRangeFrom,
    dateRangeTo,
    deliveryFrom,
    deliveryTo,
  ])

  const displaySummary = useMemo(() => {
    if (isDelivery) return buildOrderSummaryCounts(items)
    return buildOrderSummaryCounts(summaryOrders)
  }, [isDelivery, items, summaryOrders])

  const hasPhoneSearch = !isDelivery && !!phoneForApi
  const hasUserSearch = !!selectedUserId || !!normalizedSearch
  const hasDateFilter = dateRangePreset !== 'all'
  const hasStatusFilter = statusFilter !== 'all'
  const activeFilterCount =
    (hasPhoneSearch ? 1 : 0) +
    (hasUserSearch ? 1 : 0) +
    (hasStatusFilter ? 1 : 0) +
    (hasDateFilter ? 1 : 0)

  async function changeStatus(order, status) {
    if (status === order.status) return
    setBusyId(order.id)
    try {
      const updated = await adminService.patchOrderStatus(order.id, status)
      if (updated) {
        setItems((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)))
        setSummaryOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)),
        )
      } else {
        await load()
      }
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  function mergeOrderUpdate(updated) {
    if (!updated?.id) return
    setItems((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)))
    setSummaryOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)))
  }

  async function assign(orderId, deliveryAdminEmail) {
    const target = items.find((o) => o.id === orderId)
    if (target && isOrderDeliveryAssignmentLocked(target)) return
    try {
      await adminService.assignDelivery(orderId, deliveryAdminEmail)
      const patch = {
        assignedDeliveryAdminEmail: deliveryAdminEmail || null,
        deliveryStage: deliveryAdminEmail ? 'assigned' : null,
      }
      setItems((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)))
      setSummaryOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)))
      if (deliveryAdminEmail) {
        setDeliveryEmployees((prev) =>
          prev.map((employee) =>
            employee.email === deliveryAdminEmail ? { ...employee, availability: 'busy' } : employee,
          ),
        )
      }
    } catch (e) {
      setError(getFetchErrorMessage(e))
    }
  }

  const emptyStateCopy = useMemo(() => {
    if (items.length === 0 && activeFilterCount === 0) {
      return isDelivery
        ? { title: 'No deliveries yet', description: 'Orders assigned to you will appear here.' }
        : { title: 'No orders yet', description: 'New customer orders will show up in this list.' }
    }
    if (activeFilterCount >= 2) {
      return {
        title: 'No orders found',
        description: 'No orders match the selected filters. Try adjusting your search or filters.',
      }
    }
    if (hasPhoneSearch) {
      return {
        title: 'No orders found',
        description: 'No orders match this phone number. Check the number and try again.',
      }
    }
    if (hasUserSearch) {
      return {
        title: 'No orders found',
        description: 'No orders match this user or order ID search.',
      }
    }
    return {
      title: 'No orders found',
      description: 'No orders match the selected filters.',
    }
  }, [items.length, activeFilterCount, isDelivery, hasPhoneSearch, hasUserSearch])

  if (isDelivery) {
    return <Navigate to={DELIVERY_LIST_PATH} replace />
  }

  return (
    <div className={canvasClass}>
      <div className="mx-auto max-w-[90rem] space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-normal text-[#0f1111] dark:text-fog sm:text-[1.35rem]">
              {isDelivery ? 'My deliveries' : 'Orders'}
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#565959] dark:text-mist">
              {isDelivery
                ? 'Orders assigned to you. Date filters use last update time (UTC). Prices are hidden.'
                : 'Track fulfillment, update status, and assign delivery from one queue.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className={`${AMAZON_TEAL_BTN} self-start`}
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="rounded-xl border border-flare/40 bg-flare-muted px-4 py-3 text-sm text-fog">{error}</div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
          <OrderSummaryCard
            label="Total orders"
            value={summaryLoading && !isDelivery ? '…' : displaySummary.total}
            icon={ShoppingBag}
            iconBg="bg-[#f3f4f6] dark:bg-steel/30"
            iconColor="text-[#0f1111] dark:text-fog"
          />
          <OrderSummaryCard
            label="Placed"
            value={displaySummary.placed}
            icon={Clock}
            iconBg="bg-blue-50 dark:bg-blue-500/15"
            iconColor="text-blue-600"
          />
          <OrderSummaryCard
            label="Processing"
            value={displaySummary.processing}
            icon={Package}
            iconBg="bg-amber-50 dark:bg-amber-500/15"
            iconColor="text-amber-600"
          />
          <OrderSummaryCard
            label="Shipped"
            value={displaySummary.shipped}
            icon={Truck}
            iconBg="bg-green-50 dark:bg-green-500/15"
            iconColor="text-green-600"
          />
          <OrderSummaryCard
            label="Delivered"
            value={displaySummary.delivered}
            icon={CheckCircle2}
            iconBg="bg-emerald-50 dark:bg-emerald-500/15"
            iconColor="text-emerald-600"
          />
          <OrderSummaryCard
            label="Cancelled"
            value={displaySummary.cancelled}
            icon={XCircle}
            iconBg="bg-red-50 dark:bg-red-500/15"
            iconColor="text-red-600"
          />
          <OrderSummaryCard
            label="Refund"
            value={displaySummary.refund}
            icon={RotateCcw}
            iconBg="bg-purple-50 dark:bg-purple-500/15"
            iconColor="text-purple-600"
          />
        </div>

        <section className="min-w-0 rounded-lg border border-[#d5d9d9] bg-white shadow-[0_1px_2px_rgba(15,17,17,0.07)] dark:border-steel/60 dark:bg-slate">
          <div className="w-full min-w-0 border-b border-[#e7e7e7] px-3 py-3 dark:border-steel/50 sm:px-4">
            <div className={FILTER_TOOLBAR_ROW}>
              <div className="relative z-30 min-w-[280px] max-w-none w-full flex-1">
                <input
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    setSelectedUserId('')
                  }}
                  placeholder="Search by order ID, customer name, phone"
                  autoComplete="off"
                  className={`${FILTER_INPUT} w-full`}
                  aria-label="Search orders"
                />
                {selectedUserId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserId('')
                      setSearchInput('')
                    }}
                    className="mt-1 text-xs font-medium text-[#007185] hover:underline"
                  >
                    Clear selected user
                  </button>
                ) : null}
                {suggestions.length > 0 ? (
                  <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-[#d5d9d9] bg-white shadow-lg dark:border-steel/60 dark:bg-slate">
                    <ul className="max-h-72 overflow-auto">
                      {suggestions.map((u) => {
                        const avatar = resolveApiAssetUrl(u?.avatarUrl)
                        return (
                          <li key={u.id}>
                            <button
                              type="button"
                              onPointerDown={(e) => {
                                e.preventDefault()
                                setSelectedUserId(String(u.id || ''))
                                setSearchInput(`${u.name || ''}`.trim() || String(u.id || ''))
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#f7fafa] dark:hover:bg-steel/20"
                            >
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt=""
                                  className="h-8 w-8 rounded-full border border-[#d5d9d9] object-cover"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f4f6] text-xs font-semibold text-[#565959]">
                                  {(String(u?.name || 'U').trim()[0] || 'U').toUpperCase()}
                                </div>
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-[#0f1111] dark:text-fog">
                                  {u?.name?.trim() ? u.name : 'User'}
                                </span>
                                <span className="block truncate font-mono text-[10px] text-[#565959]">{u.id}</span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="w-full flex-shrink-0 lg:w-[170px]">
                <label htmlFor="orders-filter-date-range" className={FILTER_FIELD_LABEL}>
                  Date range
                </label>
                <FilterSelect
                  id="orders-filter-date-range"
                  value={dateRangePreset}
                  onChange={(e) => setDateRangePreset(e.target.value)}
                  className="w-full lg:w-[170px]"
                >
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              <div className="w-full flex-shrink-0 lg:w-[170px]">
                <label htmlFor="orders-filter-status" className={FILTER_FIELD_LABEL}>
                  Order status
                </label>
                <FilterSelect
                  id="orders-filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full lg:w-[170px]"
                >
                  {ORDER_STATUS_FILTERS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </FilterSelect>
              </div>

              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => exportOrdersToCsv(filteredItems, employeeByEmail, isDelivery)}
                  disabled={filteredItems.length === 0}
                  className={`${TOOLBAR_BTN_EXPORT} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Export
                </button>
              </div>
            </div>

            {dateRangePreset === 'custom' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#e7e7e7] pt-2 dark:border-steel/50">
                {isDelivery ? (
                  <div className="min-w-[9rem]">
                    <span className="mb-0.5 block text-[10px] text-[#565959]">Month (UTC)</span>
                    <input
                      type="month"
                      value={deliveryMonth}
                      onChange={(e) => setDeliveryMonth(e.target.value)}
                      className={FILTER_INPUT}
                    />
                  </div>
                ) : null}
                <div className="min-w-[9rem]">
                  <span className="mb-0.5 block text-[10px] text-[#565959]">From</span>
                  <input
                    type="date"
                    value={isDelivery ? deliveryFrom : dateRangeFrom}
                    onChange={(e) =>
                      isDelivery ? setDeliveryFrom(e.target.value) : setDateRangeFrom(e.target.value)
                    }
                    className={FILTER_INPUT}
                  />
                </div>
                <div className="min-w-[9rem]">
                  <span className="mb-0.5 block text-[10px] text-[#565959]">To</span>
                  <input
                    type="date"
                    value={isDelivery ? deliveryTo : dateRangeTo}
                    onChange={(e) =>
                      isDelivery ? setDeliveryTo(e.target.value) : setDateRangeTo(e.target.value)
                    }
                    className={FILTER_INPUT}
                  />
                </div>
                {isDelivery ? (
                  <button
                    type="button"
                    onClick={() => void load()}
                    className={`${TOOLBAR_BTN} mt-4 border-[#007185] bg-[#007185] text-white hover:bg-[#005f6b]`}
                  >
                    Apply dates
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="border-b border-[#e7e7e7] bg-[#fafafa] px-4 py-2.5 dark:border-steel/50 dark:bg-ink/10">
            <h2 className="text-sm font-semibold text-[#0f1111] dark:text-fog">
              {isDelivery ? 'My deliveries' : 'Manage orders'}
            </h2>
            <p className="text-[11px] text-[#565959] dark:text-mist">
              {loading
                ? 'Loading…'
                : `${filteredItems.length} order${filteredItems.length === 1 ? '' : 's'} shown`}
            </p>
          </div>

          {loading ? (
            <p className="px-4 py-12 text-center text-sm text-[#565959]">Loading orders…</p>
          ) : filteredItems.length === 0 ? (
            <OrdersEmptyState title={emptyStateCopy.title} description={emptyStateCopy.description} />
          ) : (
            <div className="overflow-x-auto lg:overflow-x-visible">
              <table className="w-full border-collapse text-left lg:table-fixed">
                <colgroup className="hidden lg:table-column-group">
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: isDelivery ? '16%' : '18%' }} />
                  {!isDelivery ? <col style={{ width: '10%' }} /> : null}
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: isDelivery ? '25%' : '13%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[#fafafa] dark:bg-ink/15">
                  <tr className="border-b border-[#e7e7e7] dark:border-steel/50">
                    <th className={TABLE_TH}>Order ID</th>
                    <th className={TABLE_TH}>Customer</th>
                    <th className={TABLE_TH}>Order status</th>
                    <th className={TABLE_TH}>Assigned</th>
                    {!isDelivery ? <th className={`${TABLE_TH} text-right`}>Amount</th> : null}
                    <th className={`${TABLE_TH} text-right`}>Items</th>
                    <th className={TABLE_TH}>Created</th>
                    <th className={`${TABLE_TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e7e7e7] dark:divide-steel/40">
                  {filteredItems.map((o) => {
                    const orderDetailPath = `/admin/orders/${encodeURIComponent(o.id)}`
                    return (
                        <tr key={o.id} className={TABLE_ROW}>
                          <td className={`${TABLE_CELL} font-mono text-xs`}>
                            <Link
                              to={orderDetailPath}
                              className="text-[#007185] hover:underline dark:text-accent"
                            >
                              {o.id}
                            </Link>
                          </td>
                          <td className={TABLE_CELL}>
                            <p className="truncate font-medium text-[#0f1111] dark:text-fog">
                              {o.customerName?.trim() ? o.customerName : 'Customer'}
                            </p>
                            {o.customerPhone ? (
                              <p className="truncate font-mono text-xs text-[#565959]">{o.customerPhone}</p>
                            ) : null}
                          </td>
                          <td className={`${TABLE_CELL} max-w-0`}>
                            <OrderStatusCell
                              order={o}
                              isDelivery={isDelivery}
                              busyId={busyId}
                              onChangeStatus={changeStatus}
                            />
                          </td>
                          <td className={`${TABLE_CELL} max-w-0 overflow-hidden`}>
                            <AssignedDeliveryCell
                              order={o}
                              isSuperAdmin={isSuperAdmin}
                              deliveryEmployees={deliveryEmployees}
                              employeeByEmail={employeeByEmail}
                              employeesLoaded={deliveryEmployeesLoaded}
                              busyId={busyId}
                              onAssign={assign}
                            />
                          </td>
                          {!isDelivery ? (
                            <td className={`${TABLE_CELL} text-right tabular-nums font-medium whitespace-nowrap`}>
                              {formatInr(o.total)}
                            </td>
                          ) : null}
                          <td className={`${TABLE_CELL} text-right tabular-nums`}>{lineItemCount(o)}</td>
                          <td className={`${TABLE_CELL_META} whitespace-nowrap`}>
                            {formatDateTime(o.createdAt)}
                          </td>
                          <td className={`${TABLE_CELL} text-right`}>
                            <OrderActionsCell
                              order={o}
                              isDelivery={isDelivery}
                              busyId={busyId}
                              onBusy={setBusyId}
                              onOrderUpdated={mergeOrderUpdate}
                              onActionError={setError}
                            />
                          </td>
                        </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!isDelivery && hasMore ? (
            <div className="flex justify-center border-t border-[#e7e7e7] px-4 py-3 dark:border-steel/50">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-lg border border-[#007185] bg-white px-5 py-2 text-sm font-medium text-[#007185] hover:bg-[#007185]/10 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
