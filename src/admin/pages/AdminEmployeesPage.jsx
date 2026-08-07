import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import * as adminService from '../../services/adminService.js'
import { getFetchErrorMessage } from '../../lib/apiErrorMessage.js'
import { imageFileToCompressedDataUrl } from '../../lib/compressImage.js'
import { employeePhotoDisplayUrl } from '../../lib/adminEmployeeAssets.js'
import { EmployeeAvatar } from '../components/EmployeeAvatar.jsx'
import { normalizeEmployeePhone, validateEmployeeEditForm } from '../../lib/employeeFormValidation.js'
import {
  employeeAvailabilityFromRow,
  normalizeEmployeeAvailability,
} from '../../lib/employeeAvailability.js'
import { subscribeWorkforceAvailabilityRefresh } from '../../lib/workforceEvents.js'
import { AdminStatCard } from '../components/AdminStatCard.jsx'

const MAX_RAW_FILE = 12 * 1024 * 1024
const LIST_PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 300
const HIGHLIGHT_MS = 6000

const filterInputClass =
  'h-9 w-full rounded-lg border border-steel/80 bg-ink/40 px-2.5 py-1.5 font-sans text-sm text-fog outline-none transition-colors focus:border-accent/60 admin-input'

const canvasClass =
  '-mx-4 min-w-0 rounded-none bg-[#eaeded] px-4 py-3 dark:bg-ink/40 md:-mx-6 md:rounded-xl md:px-5 lg:-mx-0 lg:rounded-xl lg:px-6'

const PAGE_STACK = 'space-y-3'
const FILTER_LABEL = 'mb-0.5 block font-mono text-[10px] uppercase tracking-wider text-hud'
const FILTER_CARD = 'admin-card rounded-xl p-3 shadow-sm'
const FILTER_CARD_HEAD = 'mb-2 border-b border-steel/40 pb-2'
const TABLE_SECTION = 'rounded-xl border border-[#d5d9d9] bg-white shadow-sm dark:border-steel/60 dark:bg-slate'
const TABLE_SECTION_HEAD = 'border-b border-[#e7e7e7] bg-[#fafafa] px-4 py-2 dark:border-steel/50 dark:bg-ink/15'
const TABLE_EMPTY_CELL = 'px-4 py-8 text-center'

function emptyForm() {
  return { phone: '', role: 'sales', name: '' }
}

/** @returns {'online' | 'busy' | 'offline' | 'pending'} */
function getEmployeeDisplayStatus(row) {
  return employeeAvailabilityFromRow(row)
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function displayOrNa(value) {
  if (value == null || value === '') return 'Not available'
  const s = String(value).trim()
  return s || 'Not available'
}

function employeeMatchesSearch(row, query) {
  if (!query) return true
  const q = query.toLowerCase()
  const hay = [row.id, row.name, row.phone, row.role]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function buildDisplaySummary(employees, apiSummary) {
  let online = 0
  let offline = 0
  for (const e of employees) {
    const a = employeeAvailabilityFromRow(e)
    // Pending is neither online nor offline — exclude from both summary buckets.
    if (a === 'online') online += 1
    else if (a === 'offline') offline += 1
  }
  return {
    total: typeof apiSummary?.total === 'number' ? apiSummary.total : employees.length,
    online,
    offline,
  }
}

const STATUS_BADGE_PILL =
  'inline-flex h-6 min-w-[4.25rem] items-center justify-center rounded-full border px-2.5 text-[11px] font-medium leading-none'

/** Single neutral pill — inline styles only so Sales/Delivery never pick up theme/role colors. */
const ROLE_BADGE_STYLE = {
  backgroundColor: '#f3f4f6',
  border: '1px solid #d1d5db',
  color: '#374151',
}

const TABLE_TH =
  'px-3 py-2.5 align-middle text-left text-xs font-semibold text-[#565959] dark:text-mist'
const TABLE_CELL = 'px-3 py-2.5 align-middle text-left text-sm text-[#0f1111] dark:text-fog'
const TABLE_CELL_META =
  'px-3 py-2.5 align-middle text-left text-sm text-[#565959] dark:text-mist'
const TABLE_ROW =
  'min-h-10 transition-colors hover:bg-[#f7fafa] dark:hover:bg-steel/15 [&>td]:align-middle'

/** Login/Logout: fixed width + extra left pad on Logout so the pair never collide. */
const TABLE_LOGIN_COL = 'w-[7.5rem] min-w-[7.5rem] whitespace-nowrap'
const TABLE_LOGOUT_COL = 'w-[9rem] min-w-[9rem] whitespace-nowrap !pl-6'

const WORKFORCE_FILTER_WRAP = 'min-w-[11.5rem] sm:min-w-[12.5rem]'
const WORKFORCE_FILTER_SELECT = `${filterInputClass} w-full min-w-[11.5rem] sm:min-w-[12.5rem]`

const DELETED_CELL_AT = 'whitespace-nowrap pr-4'
const DELETED_CELL_ACTIONS = 'w-[5.5rem] pr-4 text-right align-middle'

const MENU_MIN_WIDTH = 148
const MENU_GAP = 6
const MENU_EST_HEIGHT = 92
const DELETED_MENU_EST_HEIGHT = 88

const DETAIL_LABEL = 'text-[10px] font-semibold uppercase tracking-wide text-[#565959] dark:text-mist'
const DETAIL_VALUE = 'mt-0.5 text-sm text-[#0f1111] dark:text-fog'

function formatRoleLabel(role, customRoleName) {
  const r = String(role ?? '').toLowerCase()
  if (r === 'sales') return 'Sales'
  if (r === 'delivery') return 'Delivery'
  if (r === 'custom') {
    const name = String(customRoleName ?? '').trim()
    return name || 'Custom'
  }
  return role ? String(role) : '—'
}

function RoleBadge({ role, customRoleName }) {
  const label = formatRoleLabel(role, customRoleName)
  return (
    <span
      className="inline-block w-fit max-w-full rounded-full px-3 py-2 text-left text-[11px] font-medium leading-snug"
      style={ROLE_BADGE_STYLE}
    >
      {label}
    </span>
  )
}

function AvailabilityBadge({ row }) {
  const status = getEmployeeDisplayStatus(row)
  const config = {
    online: {
      label: 'Online',
      pill:
        'border-emerald-400/50 bg-emerald-500/12 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/18 dark:text-emerald-100',
    },
    busy: {
      label: 'Busy',
      pill:
        'border-amber-400/50 bg-amber-500/12 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/18 dark:text-amber-100',
    },
    pending: {
      label: 'Pending',
      pill:
        'border-yellow-400/55 bg-yellow-400/15 text-yellow-900 dark:border-yellow-500/45 dark:bg-yellow-500/18 dark:text-yellow-100',
    },
    offline: {
      label: 'Offline',
      pill: 'border-zinc-300/80 bg-zinc-200/70 text-zinc-700 dark:border-zinc-600/60 dark:bg-zinc-700/50 dark:text-zinc-200',
    },
  }
  const c = config[status] ?? config.offline
  return <span className={`${STATUS_BADGE_PILL} ${c.pill}`}>{c.label}</span>
}

function EmployeeRowActions({ row, onEdit, onDelete, onSetAvailability, availabilityBusy }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const label = row.name || row.phone || 'employee'

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? MENU_EST_HEIGHT
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < menuHeight + MENU_GAP + 12
    const top = openUpward ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP
    const right = Math.max(8, window.innerWidth - rect.right)
    setMenuPos({ top, right })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
    const raf1 = requestAnimationFrame(() => {
      updateMenuPosition()
      requestAnimationFrame(updateMenuPosition)
    })
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      cancelAnimationFrame(raf1)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onPointerDown(ev) {
      const target = ev.target
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(ev) {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const actionBtnClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-[#565959] transition-colors hover:border-[#d5d9d9] hover:bg-white dark:text-mist dark:hover:border-steel/60 dark:hover:bg-steel/30'

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: menuPos?.top ?? -9999,
              right: menuPos?.right ?? 8,
              minWidth: MENU_MIN_WIDTH,
              zIndex: 200,
              visibility: menuPos ? 'visible' : 'hidden',
            }}
            className="overflow-hidden rounded-lg border border-[#d5d9d9] bg-white py-1 shadow-[0_4px_14px_rgba(15,17,17,0.15)] dark:border-steel/60 dark:bg-slate dark:shadow-lg"
          >
            {String(row.role ?? '').toLowerCase() === 'delivery' && onSetAvailability ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={availabilityBusy}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#0f1111] hover:bg-[#f7fafa] disabled:opacity-50 dark:text-fog dark:hover:bg-steel/30"
                  onClick={() => {
                    setOpen(false)
                    onSetAvailability(row, 'online')
                  }}
                >
                  <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  Set online
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={availabilityBusy}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#0f1111] hover:bg-[#f7fafa] disabled:opacity-50 dark:text-fog dark:hover:bg-steel/30"
                  onClick={() => {
                    setOpen(false)
                    onSetAvailability(row, 'offline')
                  }}
                >
                  <WifiOff className="h-4 w-4 text-[#565959] dark:text-mist" aria-hidden />
                  Set offline
                </button>
              </>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#0f1111] hover:bg-[#f7fafa] dark:text-fog dark:hover:bg-steel/30"
              onClick={() => {
                setOpen(false)
                onEdit(row.phone)
              }}
            >
              <Pencil className="h-4 w-4 text-[#565959] dark:text-mist" aria-hidden />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#b12704] hover:bg-[#fff4f4] dark:text-flare dark:hover:bg-flare-muted/30"
              onClick={() => {
                setOpen(false)
                onDelete(row)
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div className="inline-flex items-center justify-end gap-1">
      <Link
        to={`/admin/employees/${encodeURIComponent(row.phone)}`}
        className={actionBtnClass}
        title="View profile"
        aria-label={`View profile for ${label}`}
      >
        <Eye className="h-4 w-4" />
      </Link>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${actionBtnClass} ${open ? 'border-[#d5d9d9] bg-white dark:border-steel/60 dark:bg-steel/30' : ''}`}
        aria-label={`Actions for ${label}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      </div>
      {menu}
    </>
  )
}

function DeletedEmployeeRowActions({ row, restoreBusy, onViewDetails, onRestore }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const label = row.name || row.phone || 'employee'

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? DELETED_MENU_EST_HEIGHT
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < menuHeight + MENU_GAP + 12
    const top = openUpward ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP
    const right = Math.max(8, window.innerWidth - rect.right)
    setMenuPos({ top, right })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPosition()
    const raf1 = requestAnimationFrame(() => {
      updateMenuPosition()
      requestAnimationFrame(updateMenuPosition)
    })
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      cancelAnimationFrame(raf1)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onPointerDown(ev) {
      const target = ev.target
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(ev) {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const actionBtnClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-[#565959] transition-colors hover:border-[#d5d9d9] hover:bg-white dark:text-mist dark:hover:border-steel/60 dark:hover:bg-steel/30'

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: menuPos?.top ?? -9999,
              right: menuPos?.right ?? 8,
              minWidth: MENU_MIN_WIDTH,
              zIndex: 200,
              visibility: menuPos ? 'visible' : 'hidden',
            }}
            className="overflow-hidden rounded-lg border border-[#d5d9d9] bg-white py-1 shadow-[0_4px_14px_rgba(15,17,17,0.15)] dark:border-steel/60 dark:bg-slate dark:shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#0f1111] hover:bg-[#f7fafa] dark:text-fog dark:hover:bg-steel/30"
              onClick={() => {
                setOpen(false)
                onViewDetails(row)
              }}
            >
              <Eye className="h-4 w-4 text-[#565959] dark:text-mist" aria-hidden />
              View details
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={restoreBusy}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-accent hover:bg-accent-muted disabled:opacity-50 dark:hover:bg-accent-muted/40"
              onClick={() => {
                setOpen(false)
                onRestore(row)
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {restoreBusy ? 'Restoring…' : 'Restore employee'}
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="flex justify-end">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${actionBtnClass} ${open ? 'border-[#d5d9d9] bg-white dark:border-steel/60 dark:bg-steel/30' : ''}`}
        aria-label={`Actions for ${label}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {menu}
    </div>
  )
}

function DeletedEmployeeDetailsModal({ employee, onClose }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(ev) {
      if (ev.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-steel/60 bg-slate shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-deleted-employee-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-steel/50 px-5 py-4">
          <h2
            id="admin-deleted-employee-details-title"
            className="font-display text-base font-bold tracking-tight text-fog"
          >
            Deleted employee
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-steel/60 text-fog hover:bg-steel/30"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="space-y-3 p-5">
          <div>
            <dt className={DETAIL_LABEL}>Name</dt>
            <dd className={DETAIL_VALUE}>{displayOrNa(employee.name)}</dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL}>Phone</dt>
            <dd className={`${DETAIL_VALUE} font-mono tabular-nums`}>{displayOrNa(employee.phone)}</dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL}>Role</dt>
            <dd className={DETAIL_VALUE}>
              {employee.role
                ? formatRoleLabel(employee.role, employee.customRole?.name)
                : 'Not available'}
            </dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL}>Deletion reason</dt>
            <dd className={`${DETAIL_VALUE} break-words leading-snug`}>{displayOrNa(employee.deletedReason)}</dd>
          </div>
          <div>
            <dt className={DETAIL_LABEL}>Deleted at</dt>
            <dd className={DETAIL_VALUE}>
              {employee.deletedAt ? formatDateTime(employee.deletedAt) : 'Not available'}
            </dd>
          </div>
        </dl>
        <div className="flex justify-end border-t border-steel/50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-steel/70 px-5 text-sm font-semibold text-mist hover:border-accent/60 hover:text-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminEmployeesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [apiSummary, setApiSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [highlightPhone, setHighlightPhone] = useState(null)
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE_SIZE)
  const [saving, setSaving] = useState(false)
  const [editingPhone, setEditingPhone] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm())
  const [editErrors, setEditErrors] = useState({})
  const [editPhoto, setEditPhoto] = useState('')
  const [editExistingPhoto, setEditExistingPhoto] = useState('')
  const [clearEditPhoto, setClearEditPhoto] = useState(false)
  const [editPhotoLoadError, setEditPhotoLoadError] = useState(false)
  const [workforceView, setWorkforceView] = useState('active')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [restoreBusyPhone, setRestoreBusyPhone] = useState(null)
  const [availabilityBusyPhone, setAvailabilityBusyPhone] = useState(null)
  const [deletedDetailsTarget, setDeletedDetailsTarget] = useState(null)

  const displaySummary = useMemo(
    () => buildDisplaySummary(items, apiSummary),
    [items, apiSummary],
  )

  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => {
    const state = location.state
    if (state?.success) {
      setSuccessMessage('Employee added successfully')
      if (state.highlightPhone) setHighlightPhone(String(state.highlightPhone))
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  useEffect(() => {
    if (!highlightPhone) return
    const t = window.setTimeout(() => setHighlightPhone(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(t)
  }, [highlightPhone])

  const isDeletedView = workforceView === 'deleted'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [employees, stats] = await Promise.all([
        adminService.listEmployees({ deleted: isDeletedView }),
        isDeletedView ? Promise.resolve(null) : adminService.getEmployeesSummary(),
      ])
      const sorted = [...employees].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      })
      setItems(sorted)
      setApiSummary(stats)
    } catch (e) {
      setError(getFetchErrorMessage(e))
      setItems([])
      setApiSummary(null)
    } finally {
      setLoading(false)
    }
  }, [isDeletedView])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => subscribeWorkforceAvailabilityRefresh(() => void load()), [load])

  useEffect(() => {
    setVisibleCount(LIST_PAGE_SIZE)
  }, [searchQuery, roleFilter, statusFilter, workforceView])

  useEffect(() => {
    if (!deleteTarget) return undefined
    const onKeyDown = (ev) => {
      if (ev.key === 'Escape' && !deleteBusy) {
        setDeleteTarget(null)
        setDeleteReason('')
        setDeleteError(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteTarget, deleteBusy])

  useEffect(() => {
    if (!editingPhone) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (ev) => {
      if (ev.key === 'Escape') setEditingPhone(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [editingPhone])

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      if (roleFilter && String(row.role ?? '').toLowerCase() !== roleFilter) return false
      if (!isDeletedView) {
        const displayStatus = getEmployeeDisplayStatus(row)
        if (statusFilter === 'online' && displayStatus !== 'online') return false
        if (statusFilter === 'offline' && displayStatus !== 'offline') return false
        if (statusFilter === 'busy' && displayStatus !== 'busy') return false
        if (statusFilter === 'pending' && displayStatus !== 'pending') return false
      }
      return employeeMatchesSearch(row, searchQuery)
    })
  }, [items, searchQuery, roleFilter, statusFilter, isDeletedView])

  const visibleItems = filteredItems.slice(0, visibleCount)
  const hasMore = visibleCount < filteredItems.length

  async function startEdit(phone) {
    setError(null)
    try {
      const employee = await adminService.getEmployee(phone)
      if (!employee) return
      setEditingPhone(phone)
      const role = String(employee.role ?? '').toLowerCase()
      setEditForm({
        phone: employee.phone ?? '',
        name: employee.name ?? '',
        role: role === 'delivery' ? 'delivery' : role === 'custom' ? 'custom' : 'sales',
        customRoleName: employee.customRole?.name ?? '',
        pageKeys: Array.isArray(employee.pageKeys)
          ? employee.pageKeys
          : Array.isArray(employee.customRole?.pageKeys)
            ? employee.customRole.pageKeys
            : [],
        customRoleId: employee.customRole?.id ?? '',
      })
      setEditExistingPhoto(typeof employee.photoUrl === 'string' ? employee.photoUrl : '')
      setEditPhoto('')
      setClearEditPhoto(false)
      setEditPhotoLoadError(false)
      setEditErrors({})
    } catch (e) {
      setError(getFetchErrorMessage(e))
    }
  }

  async function submitEdit(e) {
    e.preventDefault()
    if (!editingPhone) return
    const validation = validateEmployeeEditForm(editForm)
    if (!validation.values) {
      setEditErrors(validation.errors)
      return
    }
    setEditErrors({})
    setSaving(true)
    setError(null)
    try {
      const body = { ...validation.values }
      if (body.role === 'custom' && editForm.customRoleId) {
        body.customRoleId = editForm.customRoleId
      }
      if (clearEditPhoto) body.photo = ''
      else if (editPhoto) body.photo = editPhoto
      await adminService.updateEmployee(editingPhone, body)
      setEditingPhone(null)
      await load()
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function openDeleteConfirm(row) {
    setDeleteTarget(row)
    setDeleteReason('')
    setDeleteError(null)
  }

  function closeDeleteConfirm() {
    if (deleteBusy) return
    setDeleteTarget(null)
    setDeleteReason('')
    setDeleteError(null)
  }

  const deleteReasonValid = deleteReason.trim().length > 0

  async function confirmDeleteEmployee() {
    if (!deleteTarget?.phone || deleteBusy || !deleteReasonValid) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await adminService.removeEmployee(deleteTarget.phone, { reason: deleteReason.trim() })
      if (editingPhone === deleteTarget.phone) setEditingPhone(null)
      setDeleteTarget(null)
      setDeleteReason('')
      setSuccessMessage('Employee deleted successfully')
      await load()
    } catch (e) {
      setDeleteError(getFetchErrorMessage(e))
    } finally {
      setDeleteBusy(false)
    }
  }

  async function restoreEmployeeRow(row) {
    if (!row?.phone || restoreBusyPhone) return
    setRestoreBusyPhone(row.phone)
    setError(null)
    try {
      await adminService.restoreEmployee(row.phone)
      setDeletedDetailsTarget(null)
      setSuccessMessage('Employee restored successfully')
      setWorkforceView('active')
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setRestoreBusyPhone(null)
    }
  }

  async function handleSetAvailability(row, next) {
    if (!row?.phone || availabilityBusyPhone) return
    setAvailabilityBusyPhone(row.phone)
    setError(null)
    try {
      const updated = await adminService.setEmployeeAvailability(row.phone, next)
      if (updated) {
        setItems((prev) =>
          prev.map((e) =>
            e.phone === row.phone
              ? {
                  ...e,
                  availability: updated.availability,
                  availabilityStatus: updated.availabilityStatus,
                }
              : e,
          ),
        )
        setSuccessMessage(
          `${row.name || row.phone} is now ${next === 'online' ? 'online' : 'offline'}.`,
        )
      } else {
        await load()
      }
    } catch (e) {
      setError(getFetchErrorMessage(e))
    } finally {
      setAvailabilityBusyPhone(null)
    }
  }

  async function onPhotoPick(ev) {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/') || f.size > MAX_RAW_FILE) {
      setError('Photo must be an image file up to 12MB.')
      return
    }
    try {
      const dataUrl = await imageFileToCompressedDataUrl(f)
      setEditPhoto(dataUrl)
      setClearEditPhoto(false)
      setEditPhotoLoadError(false)
    } catch (e) {
      setError(getFetchErrorMessage(e))
    }
  }

  const inputClass =
    'w-full rounded-xl border border-steel/80 bg-ink/40 px-3 py-2 text-sm text-fog outline-none focus:border-accent/60 admin-input'
  const editModalFieldBase =
    'h-10 min-h-10 w-full rounded-lg border border-steel/80 bg-ink/40 px-3 text-sm text-fog outline-none focus:border-accent/60'

  function fieldInputClass(hasError) {
    return hasError ? `${inputClass} border-flare/60` : inputClass
  }
  function editModalFieldClass(hasError) {
    return hasError ? `${editModalFieldBase} border-flare/60` : editModalFieldBase
  }

  function FieldError({ message }) {
    if (!message) return null
    return <p className="mt-1 text-xs text-flare">{message}</p>
  }

  function clearEditFieldError(key) {
    if (editErrors[key]) {
      setEditErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  return (
    <div className={canvasClass}>
      <div className={`mx-auto max-w-7xl ${isDeletedView ? 'space-y-2' : PAGE_STACK}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold uppercase tracking-tight text-[#0f1111] dark:text-fog md:text-2xl">
              Employees
            </h1>
            <p className="mt-0.5 text-xs text-[#565959] dark:text-mist sm:text-sm">
              Manage workforce employees and live availability
            </p>
          </div>
          <Link
            to="/admin/employees/new"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-on-accent shadow-md transition-all hover:brightness-110 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:text-sm"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add employee
          </Link>
        </div>

        {successMessage ? (
          <div
            role="status"
            className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-fog shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/15"
          >
            <span className="font-medium text-emerald-800 dark:text-emerald-200">{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="rounded-lg p-1 text-mist hover:bg-steel/30 hover:text-fog"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-flare/40 bg-flare-muted px-3 py-2 text-sm text-fog shadow-sm">
            {error}
          </div>
        ) : null}

        {!isDeletedView ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <AdminStatCard label="Total Employees" value={displaySummary.total} icon={Users} accent="text-hud" />
          <AdminStatCard
            label="Online Employees"
            value={displaySummary.online}
            icon={Wifi}
            accent="text-emerald-600 dark:text-emerald-400"
            tone="online"
          />
          <AdminStatCard
            label="Offline Employees"
            value={displaySummary.offline}
            icon={WifiOff}
            accent="text-mist"
            tone="offline"
          />
        </div>
        ) : null}

        <section className={FILTER_CARD}>
          <div className={FILTER_CARD_HEAD}>
            <h2 className="text-sm font-semibold text-fog">Search &amp; filters</h2>
            {!isDeletedView ? (
              <p className="mt-0.5 text-xs text-mist">Find employees by details or availability</p>
            ) : null}
          </div>
          <div
            className={`grid gap-2 md:grid-cols-2 lg:items-end ${isDeletedView ? 'lg:grid-cols-[1.4fr_1fr_1fr]' : 'lg:grid-cols-[1.2fr_1fr_1fr_1fr]'}`}
          >
            <div className={isDeletedView ? '' : 'md:col-span-2 lg:col-span-1'}>
              <label htmlFor="emp-search" className={FILTER_LABEL}>
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
                <input
                  id="emp-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, phone, or role"
                  className={`${filterInputClass} pl-9`}
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label htmlFor="emp-role-filter" className={FILTER_LABEL}>
                Role
              </label>
              <select
                id="emp-role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={filterInputClass}
              >
                <option value="">All Roles</option>
                <option value="sales">Sales</option>
                <option value="delivery">Delivery</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className={WORKFORCE_FILTER_WRAP}>
              <label htmlFor="emp-workforce-filter" className={FILTER_LABEL}>
                Workforce
              </label>
              <select
                id="emp-workforce-filter"
                value={workforceView}
                onChange={(e) => setWorkforceView(e.target.value)}
                className={WORKFORCE_FILTER_SELECT}
              >
                <option value="active">Active employees</option>
                <option value="deleted">Deleted employees</option>
              </select>
            </div>
            {!isDeletedView ? (
              <div>
                <label htmlFor="emp-status-filter" className={FILTER_LABEL}>
                  Status
                </label>
                <select
                  id="emp-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={filterInputClass}
                >
                  <option value="">All</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="busy">Busy</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            ) : null}
          </div>
        </section>

        <section className={TABLE_SECTION}>
          <div className={TABLE_SECTION_HEAD}>
            <div>
              <h2 className="text-sm font-semibold leading-tight text-[#0f1111] dark:text-fog">
                {isDeletedView ? 'Deleted employees' : 'Active workforce'}
              </h2>
              <p className="text-[11px] leading-tight text-[#565959] dark:text-mist">
                {loading
                  ? 'Loading…'
                  : isDeletedView
                    ? `${filteredItems.length} deleted employee${filteredItems.length === 1 ? '' : 's'}`
                    : `${filteredItems.length} active employee${filteredItems.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left table-fixed">
              <colgroup>
                {isDeletedView ? (
                  <>
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '18%' }} />
                  </>
                ) : (
                  <>
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '144px' }} />
                    <col style={{ width: '12%' }} />
                  </>
                )}
              </colgroup>
              <thead>
                <tr className="border-b border-[#e7e7e7] bg-[#fafafa] dark:border-steel/50 dark:bg-ink/15">
                  {isDeletedView ? (
                    <>
                      <th className={TABLE_TH}>Employee</th>
                      <th className={TABLE_TH}>Phone</th>
                      <th className={TABLE_TH}>Role</th>
                      <th className={TABLE_TH}>Deleted at</th>
                      <th className={`${TABLE_TH} text-right`}>Actions</th>
                    </>
                  ) : (
                    <>
                      <th className={TABLE_TH}>Employee</th>
                      <th className={TABLE_TH}>Contact</th>
                      <th className={TABLE_TH}>Role</th>
                      <th className={TABLE_TH}>Status</th>
                      <th className={`${TABLE_TH} ${TABLE_LOGIN_COL}`}>Login</th>
                      <th className={`${TABLE_TH} ${TABLE_LOGOUT_COL}`}>Logout</th>
                      <th className={`${TABLE_TH} text-right`}>Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e7e7] bg-white dark:divide-steel/40 dark:bg-slate">
                {loading ? (
                  <tr>
                    <td colSpan={isDeletedView ? 5 : 7} className={`${TABLE_EMPTY_CELL} text-mist`}>
                      Loading employees…
                    </td>
                  </tr>
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={isDeletedView ? 5 : 7} className={TABLE_EMPTY_CELL}>
                      <p className="font-medium text-fog">No employees found</p>
                      <p className="mt-1 text-sm text-mist">
                        {items.length === 0
                          ? isDeletedView
                            ? 'No deleted employees on record.'
                            : 'Add your first employee to get started.'
                          : 'Try adjusting search or filters.'}
                      </p>
                      {!isDeletedView && items.length === 0 ? (
                        <Link
                          to="/admin/employees/new"
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                          Add employee
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((row) => {
                    const isHighlighted = highlightPhone && row.phone === highlightPhone
                    return (
                      <tr
                        key={row.id || row.phone}
                        className={`${TABLE_ROW} ${isHighlighted ? 'bg-emerald-500/10' : ''}`}
                      >
                        {isDeletedView ? (
                          <>
                            <td className={TABLE_CELL}>
                              <p className="truncate font-semibold text-fog">{row.name || '—'}</p>
                            </td>
                            <td className={`${TABLE_CELL} font-mono tabular-nums`}>{row.phone || '—'}</td>
                            <td className={TABLE_CELL}>
                              <RoleBadge role={row.role} customRoleName={row.customRole?.name} />
                            </td>
                            <td className={`${TABLE_CELL_META} ${DELETED_CELL_AT}`}>
                              {row.deletedAt ? formatDateTime(row.deletedAt) : 'Not available'}
                            </td>
                            <td className={`${TABLE_CELL} ${DELETED_CELL_ACTIONS}`}>
                              <DeletedEmployeeRowActions
                                row={row}
                                restoreBusy={restoreBusyPhone === row.phone}
                                onViewDetails={setDeletedDetailsTarget}
                                onRestore={(r) => void restoreEmployeeRow(r)}
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className={TABLE_CELL}>
                              <div className="flex items-center gap-3">
                                <EmployeeAvatar employee={row} />
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <p className="truncate font-semibold text-fog">{row.name || '—'}</p>
                                  {isHighlighted ? (
                                    <span className="inline-flex shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-on-accent">
                                      New
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td className={`${TABLE_CELL} font-mono tabular-nums`}>{row.phone || '—'}</td>
                            <td className={TABLE_CELL}>
                              <RoleBadge role={row.role} customRoleName={row.customRole?.name} />
                            </td>
                            <td className={TABLE_CELL}>
                              <AvailabilityBadge row={row} />
                            </td>
                            <td className={`${TABLE_CELL_META} ${TABLE_LOGIN_COL}`}>
                              {formatDateTime(row.lastLoginAt)}
                            </td>
                            <td className={`${TABLE_CELL_META} ${TABLE_LOGOUT_COL}`}>
                              {formatDateTime(row.lastLogoutAt)}
                            </td>
                            <td className={`${TABLE_CELL} text-right`}>
                              <EmployeeRowActions
                                row={row}
                                onEdit={startEdit}
                                onDelete={openDeleteConfirm}
                                onSetAvailability={handleSetAvailability}
                                availabilityBusy={availabilityBusyPhone === row.phone}
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {hasMore ? (
            <div className="flex justify-center border-t border-steel/40 px-3 py-2">
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + LIST_PAGE_SIZE)}
                className="rounded-xl border border-steel/80 bg-ink/20 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-mist transition-colors hover:border-accent/50 hover:text-accent"
              >
                Load more
              </button>
            </div>
          ) : null}
        </section>

        {deletedDetailsTarget ? (
          <DeletedEmployeeDetailsModal
            employee={deletedDetailsTarget}
            onClose={() => setDeletedDetailsTarget(null)}
          />
        ) : null}

        {deleteTarget ? (
          <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
            role="presentation"
            onClick={closeDeleteConfirm}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-steel/60 bg-slate shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-delete-employee-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-steel/50 px-5 py-4">
                <h2 id="admin-delete-employee-title" className="font-display text-base font-bold tracking-tight text-fog">
                  Delete employee?
                </h2>
                <button
                  type="button"
                  onClick={closeDeleteConfirm}
                  disabled={deleteBusy}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-steel/60 text-fog hover:bg-steel/30 disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-5">
                <p className="text-sm text-mist">
                  This employee will be removed from the active workforce list and unassigned from open deliveries.
                  You can restore them later from the deleted employees view.
                </p>
                <div>
                  <label htmlFor="emp-delete-reason" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mist">
                    Reason for deletion <span className="text-flare">*</span>
                  </label>
                  <textarea
                    id="emp-delete-reason"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={3}
                    required
                    placeholder="Enter why this employee is being removed…"
                    className="w-full resize-y rounded-lg border border-steel/80 bg-ink/40 px-3 py-2 text-sm text-fog outline-none focus:border-accent/60 admin-input"
                  />
                </div>
                {deleteTarget.name || deleteTarget.phone ? (
                  <p className="rounded-lg border border-steel/50 bg-ink/20 px-3 py-2 text-sm text-fog">
                    {deleteTarget.name ? (
                      <span className="font-semibold">{deleteTarget.name}</span>
                    ) : null}
                    {deleteTarget.name && deleteTarget.phone ? (
                      <span className="text-mist"> · </span>
                    ) : null}
                    {deleteTarget.phone ? (
                      <span className="font-mono text-mist">{deleteTarget.phone}</span>
                    ) : null}
                  </p>
                ) : null}
                {deleteError ? (
                  <p className="rounded border border-flare/40 bg-flare-muted px-3 py-2 text-sm text-fog">{deleteError}</p>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-steel/50 bg-slate px-5 py-4">
                <button
                  type="button"
                  onClick={closeDeleteConfirm}
                  disabled={deleteBusy}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-steel/70 px-5 text-sm font-semibold text-mist hover:border-hud/60 hover:text-hud disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteEmployee()}
                  disabled={deleteBusy || !deleteReasonValid}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-flare px-5 text-sm font-semibold uppercase tracking-[0.08em] text-on-accent shadow-sm disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteBusy ? 'Deleting…' : 'Delete employee'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editingPhone ? (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
            role="presentation"
            onClick={() => setEditingPhone(null)}
          >
            <div
              className="flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-steel/60 bg-slate shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-edit-employee-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-steel/50 bg-slate px-5 py-4">
                <h2 id="admin-edit-employee-title" className="font-display text-base font-bold tracking-tight text-fog md:text-lg">
                  Edit Employee
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingPhone(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-steel/60 text-fog hover:bg-steel/30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form id="admin-edit-employee-form" onSubmit={submitEdit} className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4" noValidate>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  <div>
                    <input
                      placeholder="Phone *"
                      value={editForm.phone}
                      onChange={(e) => {
                        setEditForm((f) => ({ ...f, phone: normalizeEmployeePhone(e.target.value) }))
                        clearEditFieldError('phone')
                      }}
                      maxLength={10}
                      className={editModalFieldClass(editErrors.phone)}
                      aria-invalid={!!editErrors.phone}
                    />
                    <FieldError message={editErrors.phone} />
                  </div>
                  <div>
                    <input
                      placeholder="Full Name *"
                      value={editForm.name}
                      onChange={(e) => {
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                        clearEditFieldError('name')
                      }}
                      className={editModalFieldClass(editErrors.name)}
                      aria-invalid={!!editErrors.name}
                    />
                    <FieldError message={editErrors.name} />
                  </div>
                  <div>
                    {editForm.role === 'custom' ? (
                      <>
                        <div
                          className={`${editModalFieldClass(false)} flex flex-col justify-center gap-0.5`}
                        >
                          <span className="text-sm text-fog">
                            {editForm.customRoleName || 'Custom role'}
                          </span>
                          <span className="text-[11px] text-mist">
                            {Array.isArray(editForm.pageKeys) && editForm.pageKeys.length
                              ? `Pages: ${editForm.pageKeys.join(', ')}`
                              : 'Page permissions managed when creating the role'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-mist">
                          Role type is fixed for custom employees here (permission editing comes later).
                        </p>
                      </>
                    ) : (
                      <>
                        <select
                          value={editForm.role}
                          onChange={(e) => {
                            setEditForm((f) => ({ ...f, role: e.target.value }))
                            clearEditFieldError('role')
                          }}
                          className={editModalFieldClass(editErrors.role)}
                          aria-invalid={!!editErrors.role}
                        >
                          <option value="sales">Sales</option>
                          <option value="delivery">Delivery</option>
                        </select>
                        <FieldError message={editErrors.role} />
                      </>
                    )}
                  </div>
                  <div />
                </div>
                <div className="rounded-lg border border-steel/50 bg-ink/20 p-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-hud">Photo (optional)</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onPhotoPick}
                    className="text-xs text-mist file:mr-2 file:rounded-md file:border-0 file:bg-hud file:px-2.5 file:py-1.5 file:font-mono file:text-[10px] file:text-white"
                  />
                  {editPhoto || (editExistingPhoto && !clearEditPhoto) ? (
                    !editPhotoLoadError ? (
                      <img
                        src={
                          editPhoto ||
                          employeePhotoDisplayUrl({ photoUrl: editExistingPhoto }) ||
                          editExistingPhoto
                        }
                        alt={editPhoto ? 'Edited preview' : 'Current'}
                        onError={() => setEditPhotoLoadError(true)}
                        className="mt-2 h-16 w-16 rounded-md border border-steel/60 object-cover"
                      />
                    ) : (
                      <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-md border border-steel/60 bg-steel/20 text-[10px] font-semibold uppercase tracking-wide text-mist">
                        No image
                      </div>
                    )
                  ) : (
                    <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-md border border-steel/60 bg-steel/20 text-[10px] font-semibold uppercase tracking-wide text-mist">
                      No image
                    </div>
                  )}
                  <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-mist">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500"
                      checked={clearEditPhoto}
                      onChange={(e) => setClearEditPhoto(e.target.checked)}
                    />
                    Remove existing photo
                  </label>
                </div>
              </form>
              <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-end gap-2 border-t border-steel/50 bg-slate px-5 py-4">
                <button
                  type="button"
                  onClick={() => setEditingPhone(null)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-steel/70 px-5 text-sm font-semibold text-mist hover:border-hud/60 hover:text-hud"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="admin-edit-employee-form"
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-accent px-5 text-sm font-semibold uppercase tracking-[0.08em] text-on-accent shadow-sm disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save Employee'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
