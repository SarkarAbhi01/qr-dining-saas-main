import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from '@/routes/ProtectedRoute';
import { ROLES } from '@/store/authStore';

// पब्लिक और ज़रूरी पेजों को सामान्य तरीके से इम्पोर्ट रखना बेहतर है ताकि वो तुरंत लोड हों
import Login from '@/pages/auth/Login';
import NotFound from '@/pages/NotFound';
import Unauthorized from '@/pages/Unauthorized';

// भारी और अंदरूनी पेजों को Lazy Load (Dynamic Import) किया गया है
const SuperadminDashboard = lazy(() => import('@/pages/superadmin/Dashboard'));
const OwnerDashboard = lazy(() => import('@/pages/owner/Dashboard'));
const KitchenKDS = lazy(() => import('@/pages/kitchen/KDS'));
const WaiterDashboard = lazy(() => import('@/pages/waiter/Dashboard'));
const CustomerApp = lazy(() => import('@/pages/customer/CustomerApp'));
const CustomerMenu = lazy(() => import('@/pages/customer/Menu'));
const CustomerCart = lazy(() => import('@/pages/customer/Cart'));
const CustomerOrders = lazy(() => import('@/pages/customer/OrderTracking'));
const PaymentConfirm = lazy(() => import('@/pages/customer/PaymentConfirm'));

export default function App() {
  return (
    // Suspense का घेरा लगाया गया है, जब तक पेज बैकग्राउंड में लोड होगा तब तक 'Loading...' स्क्रीन दिखेगी
    <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>}>
      <Routes>
        {/* --- Public --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Stripe redirects here after hosted checkout */}
        <Route path="/order/pay/confirm" element={<PaymentConfirm />} />

        {/* Customer QR flow — no login, table identified via URL param */}
        <Route path="/order/:restaurantSlug/:tableId" element={<CustomerApp />}>
          <Route index element={<CustomerMenu />} />
          <Route path="cart" element={<CustomerCart />} />
          <Route path="orders" element={<CustomerOrders />} />
        </Route>

        {/* --- Superadmin --- */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPERADMIN]} />}>
          <Route path="/superadmin/*" element={<SuperadminDashboard />} />
        </Route>

        {/* --- Owner / Manager --- */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.OWNER, ROLES.MANAGER]} />}>
          <Route path="/owner/*" element={<OwnerDashboard />} />
        </Route>

        {/* --- Chef / KDS (Owner/Manager can also monitor the kitchen) --- */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.CHEF, ROLES.OWNER, ROLES.MANAGER]} />}>
          <Route path="/kitchen/*" element={<KitchenKDS />} />
        </Route>

        {/* --- Waiter (Owner/Manager can also work the floor) --- */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.WAITER, ROLES.OWNER, ROLES.MANAGER]} />}>
          <Route path="/waiter/*" element={<WaiterDashboard />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
