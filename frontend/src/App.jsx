import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from '@/routes/ProtectedRoute';
import { ROLES } from '@/store/authStore';

import Login from '@/pages/auth/Login';
import NotFound from '@/pages/NotFound';
import Unauthorized from '@/pages/Unauthorized';

import SuperadminDashboard from '@/pages/superadmin/Dashboard';
import OwnerDashboard from '@/pages/owner/Dashboard';
import KitchenKDS from '@/pages/kitchen/KDS';
import WaiterDashboard from '@/pages/waiter/Dashboard';
import CustomerApp from '@/pages/customer/CustomerApp';
import CustomerMenu from '@/pages/customer/Menu';
import CustomerCart from '@/pages/customer/Cart';
import CustomerOrders from '@/pages/customer/OrderTracking';

export default function App() {
  return (
    <Routes>
      {/* --- Public --- */}
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

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

      {/* --- Chef / KDS --- */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.CHEF]} />}>
        <Route path="/kitchen/*" element={<KitchenKDS />} />
      </Route>

      {/* --- Waiter --- */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.WAITER]} />}>
        <Route path="/waiter/*" element={<WaiterDashboard />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
