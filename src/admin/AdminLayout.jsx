import { useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  FolderTree,
  Users,
  UserCog,
  CarFront,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import { DELIVERY_HOME_PATH, DELIVERY_LIST_PATH } from '../lib/deliveryRoutes.js'

function DeliveryBottomNav() {
  const tabs = [
    { to: DELIVERY_HOME_PATH, end: true, label: 'Home', icon: LayoutDashboard },
    { to: DELIVERY_LIST_PATH, label: 'Deliveries', icon: ShoppingBag },
  ]
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_24px_rgba(15,23,42,0.08)] backdrop-blur-md md:hidden"
      aria-label="Delivery navigation"
    >
      <div className="mx-auto flex max-w-lg justify-around gap-1">
        {tabs.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex min-h-[52px] min-w-[7rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold uppercase tracking-wide',
                isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-500',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function navByRole(role) {
  if (role === 'delivery') {
    return [
      {
        to: DELIVERY_HOME_PATH,
        end: true,
        label: 'Dashboard',
        icon: LayoutDashboard,
      },
      { to: DELIVERY_LIST_PATH, label: 'My deliveries', icon: ShoppingBag },
    ]
  }

  const base = [
    {
      to: '/admin',
      end: true,
      label: 'Analytics',
      icon: LayoutDashboard,
    },
  ]
  if (role === 'super_admin' || role === 'sales') {
    base.push({ to: '/admin/products', label: 'Products', icon: Package })
  }
  if (role === 'super_admin') {
    base.push({ to: '/admin/cars', label: 'Cars', icon: CarFront })
    base.push({ to: '/admin/categories', label: 'Categories', icon: FolderTree })
    base.push({ to: '/admin/users', label: 'Users', icon: Users })
    base.push({ to: '/admin/employees', label: 'Employees', icon: UserCog })
  }
  base.push({ to: '/admin/orders', label: 'Orders', icon: ShoppingBag })
  return base
}

function NavItems({ onNavigate, role }) {
  const nav = navByRole(role)
  return (
    <nav className="flex flex-col gap-1 p-2">
      {nav.map(({ to, end, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-xl px-3 py-2.5 font-sans text-xs font-semibold uppercase tracking-wide transition-colors',
              isActive
                ? 'bg-accent-muted text-accent ring-1 ring-accent/35'
                : 'text-mist hover:bg-steel/40 hover:text-fog',
            ].join(' ')
          }
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { sessionRole } = useAuth()
  const role = ['super_admin', 'sales', 'delivery'].includes(sessionRole) ? sessionRole : 'super_admin'
  const sidebarSectionLabel = role === 'delivery' ? 'DELIVERY' : 'ADMIN'

  const isDelivery = role === 'delivery'

  return (
    <div className={`pt-4 text-fog md:pt-6 ${isDelivery ? 'pb-24 md:pb-16' : 'pb-16'}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:flex-row md:gap-8 md:px-6 lg:px-10">
        <div className={isDelivery ? 'hidden' : 'md:hidden'}>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="admin-card flex w-full items-center justify-between px-4 py-3 font-display text-sm font-bold uppercase tracking-wide text-fog"
          >
            {role === 'delivery' ? 'Delivery menu' : 'Admin menu'}
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          {mobileOpen && (
            <div className="admin-card mt-2 p-2">
              <NavItems role={role} onNavigate={() => setMobileOpen(false)} />
            </div>
          )}
        </div>

        <aside className="hidden w-52 shrink-0 md:block lg:w-56">
          <div className="admin-card sticky top-20 p-3">
            <p className="px-2 pb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-mist">
              {sidebarSectionLabel}
            </p>
            <NavItems role={role} />
            <Link
              to="/"
              className="mt-3 block px-3 py-2 font-sans text-xs font-medium text-accent underline-offset-2 hover:underline"
            >
              ← Store home
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
      {isDelivery ? <DeliveryBottomNav /> : null}
    </div>
  )
}
