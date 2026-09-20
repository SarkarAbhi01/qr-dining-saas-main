import { Routes, Route, Navigate } from 'react-router-dom';
import { LayoutDashboard, Building2, CreditCard, TrendingUp, DatabaseBackup } from 'lucide-react';

import DashboardShell from '@/layouts/DashboardShell';
import Overview from './Overview';
import Restaurants from './Restaurants';
import RestaurantDetail from './RestaurantDetail';
import Plans from './Plans';
import Revenue from './Revenue';
import Backups from './Backups';

const navItems = [
  { to: '/superadmin', label: 'Overview', icon: LayoutDashboard },
  { to: '/superadmin/restaurants', label: 'Restaurants', icon: Building2 },
  { to: '/superadmin/revenue', label: 'Revenue', icon: TrendingUp },
  { to: '/superadmin/plans', label: 'Plans', icon: CreditCard },
  { to: '/superadmin/backups', label: 'Backups', icon: DatabaseBackup },
];

export default function SuperadminDashboard() {
  return (
    <DashboardShell title="Superadmin" navItems={navItems}>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="restaurants/:id" element={<RestaurantDetail />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="plans" element={<Plans />} />
        <Route path="backups" element={<Backups />} />
        <Route path="*" element={<Navigate to="/superadmin" replace />} />
      </Routes>
    </DashboardShell>
  );
}
