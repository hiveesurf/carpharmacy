import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  FolderTree,
  Users,
  UserCog,
  CarFront,
  BarChart3,
  Scale,
} from 'lucide-react'

/** Canonical admin page keys — must match backend AdminPageKey / custom_role_permissions. */
export const ADMIN_PAGE_DEFS = [
  { key: 'analytics', label: 'Analytics', to: '/admin', end: true, icon: LayoutDashboard },
  { key: 'inventory', label: 'Inventory', to: '/admin/products', icon: Package },
  { key: 'cars', label: 'Cars', to: '/admin/cars', icon: CarFront },
  { key: 'categories', label: 'Categories', to: '/admin/categories', icon: FolderTree },
  { key: 'sales_report', label: 'Sales report', to: '/admin/sales-report', icon: BarChart3 },
  { key: 'reconciliation', label: 'Reconciliation', to: '/admin/reconciliation', icon: Scale },
  { key: 'users', label: 'Users', to: '/admin/users', icon: Users },
  { key: 'employees', label: 'Employees', to: '/admin/employees', icon: UserCog },
  { key: 'orders', label: 'Orders', to: '/admin/orders', icon: ShoppingBag },
]

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizePageKeys(raw) {
  if (!Array.isArray(raw)) return []
  const allowed = new Set(ADMIN_PAGE_DEFS.map((d) => d.key))
  const out = []
  for (const item of raw) {
    const key = String(item ?? '')
      .trim()
      .toLowerCase()
    if (allowed.has(key) && !out.includes(key)) out.push(key)
  }
  return out
}

/**
 * Map a pathname under /admin to a page_key, or null if not a permissioned page.
 * @param {string} pathname
 * @returns {string | null}
 */
export function pathRequiresPageKey(pathname) {
  const path = String(pathname ?? '').split('?')[0]
  if (!path.startsWith('/admin')) return null
  const rest = path.slice('/admin'.length).replace(/^\//, '')
  if (!rest) return 'analytics'
  const segment = rest.split('/')[0]
  switch (segment) {
    case 'products':
      return 'inventory'
    case 'cars':
      return 'cars'
    case 'categories':
      return 'categories'
    case 'sales-report':
      return 'sales_report'
    case 'reconciliation':
      return 'reconciliation'
    case 'users':
      return 'users'
    case 'employees':
      return 'employees'
    case 'orders':
      return 'orders'
    case 'deliveries':
      return 'orders'
    default:
      return null
  }
}

/**
 * @param {string[]} pageKeys
 * @returns {string}
 */
export function firstAllowedAdminPath(pageKeys) {
  const keys = normalizePageKeys(pageKeys)
  for (const def of ADMIN_PAGE_DEFS) {
    if (keys.includes(def.key)) return def.to
  }
  return '/admin'
}

/**
 * @param {string[]} pageKeys
 */
export function navItemsForCustomRole(pageKeys) {
  const keys = new Set(normalizePageKeys(pageKeys))
  return ADMIN_PAGE_DEFS.filter((d) => keys.has(d.key)).map(({ to, end, label, icon }) => ({
    to,
    end,
    label,
    icon,
  }))
}

/**
 * @param {string} pathname
 * @param {string[]} pageKeys
 */
export function customRoleCanAccessPath(pathname, pageKeys) {
  const required = pathRequiresPageKey(pathname)
  if (!required) return false
  return normalizePageKeys(pageKeys).includes(required)
}
