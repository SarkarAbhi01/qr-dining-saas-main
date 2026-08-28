import { Routes, Route, Navigate } from 'react-router-dom';
import { UtensilsCrossed, QrCode, Users, Activity, BarChart3, CreditCard, MessageSquare, Banknote, Settings as SettingsIcon, Palette } from 'lucide-react';

import DashboardShell from '@/layouts/DashboardShell';
import Menu from './Menu';
import Tables from './Tables';
import Staff from './Staff';
import LiveView from './LiveView';
import Reports from './Reports';
import Billing from './Billing';
import Feedback from './Feedback';
import Payments from './Payments';
import Settings from './Settings';
import Theme from './Theme';

const navItems = [
  { to: '/owner', label: 'Menu', icon: UtensilsCrossed },
  { to: '/owner/tables', label: 'Tables', icon: QrCode },
  { to: '/owner/staff', label: 'Staff', icon: Users },
  { to: '/owner/live', label: 'Live View', icon: Activity },
  { to: '/owner/payments', label: 'Payments', icon: Banknote },
  { to: '/owner/reports', label: 'Reports', icon: BarChart3 },
  { to: '/owner/feedback', label: 'Feedback', icon: MessageSquare },
  { to: '/owner/billing', label: 'Billing', icon: CreditCard },
  { to: '/owner/theme', label: 'Theme', icon: Palette },
  { to: '/owner/settings', label: 'Settings', icon: SettingsIcon },
];

export default function OwnerDashboard() {
  return (
    <DashboardShell title="Owner" navItems={navItems}>
      <Routes>
        <Route index element={<Menu />} />
        <Route path="tables" element={<Tables />} />
        <Route path="staff" element={<Staff />} />
        <Route path="live" element={<LiveView />} />
        <Route path="payments" element={<Payments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="billing" element={<Billing />} />
        <Route path="theme" element={<Theme />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/owner" replace />} />
      </Routes>
    </DashboardShell>
  );
}
