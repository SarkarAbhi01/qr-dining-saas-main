import { Routes, Route, Navigate } from 'react-router-dom';
import { Grid3x3, Bell as BellIcon, ClipboardList, Banknote } from 'lucide-react';

import DashboardShell from '@/layouts/DashboardShell';
import TableGrid from './TableGrid';
import ServiceQueue from './ServiceQueue';
import ManualOrder from './ManualOrder';
import Calls from './Calls';
import Payments from './Payments';

const navItems = [
  { to: '/waiter', label: 'Tables', icon: Grid3x3 },
  { to: '/waiter/queue', label: 'Queue', icon: ClipboardList },
  { to: '/waiter/payments', label: 'Payments', icon: Banknote },
  { to: '/waiter/calls', label: 'Calls', icon: BellIcon },
];

export default function WaiterDashboard() {
  return (
    <DashboardShell title="Waiter" navItems={navItems}>
      <Routes>
        <Route index element={<TableGrid />} />
        <Route path="queue" element={<ServiceQueue />} />
        <Route path="payments" element={<Payments />} />
        <Route path="calls" element={<Calls />} />
        <Route path="order/:tableId" element={<ManualOrder />} />
        <Route path="*" element={<Navigate to="/waiter" replace />} />
      </Routes>
    </DashboardShell>
  );
}
