import { useEffect, useLayoutEffect, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AdminRoute } from './components/auth/AdminRoute.jsx'
import { AdminLayout } from './admin/AdminLayout.jsx'
import { AdminOverviewPage } from './admin/pages/AdminOverviewPage.jsx'
import { AdminProductsPage } from './admin/pages/AdminProductsPage.jsx'
import { AdminCarsPage } from './admin/pages/AdminCarsPage.jsx'
import { AdminOrdersPage } from './admin/pages/AdminOrdersPage.jsx'
import { AdminOrderDetailsPage } from './admin/pages/AdminOrderDetailsPage.jsx'
import { AdminCategoriesPage } from './admin/pages/AdminCategoriesPage.jsx'
import { AdminUsersPage } from './admin/pages/AdminUsersPage.jsx'
import { AdminEmployeesPage } from './admin/pages/AdminEmployeesPage.jsx'
import { AdminAddEmployeePage } from './admin/pages/AdminAddEmployeePage.jsx'
import { AdminAddProductPage } from './admin/pages/AdminAddProductPage.jsx'
import { AdminAddCarPage } from './admin/pages/AdminAddCarPage.jsx'
import { AdminUserProfilePage } from './admin/pages/AdminUserProfilePage.jsx'
import { AdminEmployeeProfilePage } from './admin/pages/AdminEmployeeProfilePage.jsx'
import { DeliveryPartnerOrdersPage } from './admin/pages/DeliveryPartnerOrdersPage.jsx'
import { DeliveryDetailsPage } from './admin/pages/delivery/DeliveryDetailsPage.jsx'
import { DeliveryOtpPage } from './admin/pages/delivery/DeliveryOtpPage.jsx'
import { DeliveryProofPage } from './admin/pages/delivery/DeliveryProofPage.jsx'
import { DeliverySuccessPage } from './admin/pages/delivery/DeliverySuccessPage.jsx'
import { markHeroUserLeftHome } from './lib/heroSession'
import { Navbar } from './components/layout/Navbar'
import { AdminAppShell } from './components/layout/AdminAppShell.jsx'
import { Footer } from './components/layout/Footer'
import { Noise } from './components/ui/Noise'
import { CartDrawer } from './components/cart/CartDrawer'
import { AuthModals } from './components/auth/AuthModals'
import { HomePage } from './pages/HomePage'
import { CarsListPage } from './pages/CarsListPage'
import { PartsCatalogPage } from './pages/PartsCatalogPage'
import { PartsProductDetailPage } from './pages/PartsProductDetailPage.jsx'
import { AccountPage } from './pages/AccountPage'
import { OrdersPage } from './pages/OrdersPage.jsx'
import { CartPage } from './pages/CartPage.jsx'
import { CheckoutPage } from './pages/CheckoutPage.jsx'
import { OrderConfirmationPage } from './pages/OrderConfirmationPage.jsx'
import { FavoritesPage } from './pages/FavoritesPage'
import { PolicyDocumentPage } from './pages/PolicyDocumentPage'
import {
  AdminHomeGate,
  DeliveryLegacyDetailRedirect,
  DeliveryLegacyListRedirect,
  DeliveryLegacyOtpRedirect,
  DeliveryLegacyProofRedirect,
  DeliveryLegacySuccessRedirect,
} from './components/routing/DeliveryRouteRedirects.jsx'

function ScrollOnRouteChange() {
  const { pathname, hash } = useLocation()

  useLayoutEffect(() => {
    if (hash && hash !== '#') {
      const id = decodeURIComponent(hash.slice(1))
      if (!id) return
      const t = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)
      return () => clearTimeout(t)
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname, hash])

  return null
}

function AppShell({ children }) {
  return (
    <div className="relative min-h-svh bg-ink text-fog antialiased [--nav-h:4.25rem] md:[--nav-h:4.75rem]">
      <Noise />
      <Navbar />
      <ScrollOnRouteChange />
      <main className="relative z-[1]">{children}</main>
      <Footer />
      <CartDrawer />
      <AuthModals />
    </div>
  )
}

function SyncHeroReturnSession() {
  const location = useLocation()
  const prevPath = useRef(location.pathname)
  useLayoutEffect(() => {
    if (prevPath.current === '/' && location.pathname !== '/') {
      markHeroUserLeftHome()
    }
    prevPath.current = location.pathname
  }, [location.pathname])

  // Full navigation away from Home (e.g. form using location.assign) never hits the router effect.
  useEffect(() => {
    const onBeforeUnload = () => {
      const p = window.location.pathname
      if (p === '/' || p === '') {
        markHeroUserLeftHome()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  return null
}

export default function App() {
  return (
    <>
      <SyncHeroReturnSession />
    <Routes>
      <Route path="/catalog" element={<AppShell><PartsCatalogPage /></AppShell>} />
      <Route
        path="/catalog/products/:productId"
        element={
          <AppShell>
            <PartsProductDetailPage />
          </AppShell>
        }
      />
      <Route path="/cart" element={<AppShell><CartPage /></AppShell>} />
      <Route path="/checkout" element={<AppShell><CheckoutPage /></AppShell>} />
      <Route path="/orders/confirmation/:id" element={<AppShell><OrderConfirmationPage /></AppShell>} />
      <Route path="/account" element={<AppShell><AccountPage /></AppShell>} />
      <Route path="/orders" element={<AppShell><OrdersPage /></AppShell>} />
      <Route path="/favorites" element={<AppShell><FavoritesPage /></AppShell>} />
      <Route path="/cars" element={<AppShell><CarsListPage /></AppShell>} />
      <Route path="/privacy" element={<AppShell><PolicyDocumentPage kind="privacy" /></AppShell>} />
      <Route path="/terms" element={<AppShell><PolicyDocumentPage kind="terms" /></AppShell>} />
      <Route path="/returns" element={<AppShell><PolicyDocumentPage kind="returns" /></AppShell>} />
      <Route path="/warranty" element={<AppShell><PolicyDocumentPage kind="warranty" /></AppShell>} />
      <Route path="/" element={<AppShell><HomePage /></AppShell>} />
      <Route
        path="/admin"
        element={
          <AdminAppShell>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </AdminAppShell>
        }
      >
        <Route index element={<AdminHomeGate />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="products/add" element={<AdminAddProductPage />} />
        <Route path="cars" element={<AdminCarsPage />} />
        <Route path="cars/add" element={<AdminAddCarPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:orderId" element={<AdminOrderDetailsPage />} />
        <Route path="deliveries" element={<DeliveryLegacyListRedirect />} />
        <Route path="deliveries/:orderId" element={<DeliveryLegacyDetailRedirect />} />
        <Route path="deliveries/:orderId/otp" element={<DeliveryLegacyOtpRedirect />} />
        <Route path="deliveries/:orderId/proof" element={<DeliveryLegacyProofRedirect />} />
        <Route path="deliveries/:orderId/success" element={<DeliveryLegacySuccessRedirect />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:id" element={<AdminUserProfilePage />} />
        <Route path="employees" element={<AdminEmployeesPage />} />
        <Route path="employees/new" element={<AdminAddEmployeePage />} />
        <Route path="employees/:phone" element={<AdminEmployeeProfilePage />} />
      </Route>
      <Route
        path="/delivery"
        element={
          <AdminAppShell>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </AdminAppShell>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="orders" element={<DeliveryPartnerOrdersPage />} />
        <Route path="orders/:orderId" element={<DeliveryDetailsPage />} />
        <Route path="orders/:orderId/otp" element={<DeliveryOtpPage />} />
        <Route path="orders/:orderId/proof" element={<DeliveryProofPage />} />
        <Route path="orders/:orderId/success" element={<DeliverySuccessPage />} />
      </Route>
    </Routes>
    </>
  )
}
