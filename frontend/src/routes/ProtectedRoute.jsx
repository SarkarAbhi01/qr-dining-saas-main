import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Wraps a set of routes and enforces:
 *  1. The user is authenticated
 *  2. The user's role is one of `allowedRoles` (if provided)
 *
 * Usage:
 *   <Route element={<ProtectedRoute allowedRoles={['OWNER','MANAGER']} />}>
 *     <Route path="/owner" element={<OwnerDashboard />} />
 *   </Route>
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, accessToken } = useAuthStore();

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
