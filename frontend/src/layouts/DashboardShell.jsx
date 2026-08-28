import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import api from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { disconnectSocket } from '@/sockets/socketClient';
import { isSoundEnabled, setSoundEnabled } from '@/utils/sound';
import { useRestaurantTheme } from '@/hooks/useRestaurantTheme';

/**
 * `navItems`: [{ to, label, icon: LucideIcon }]
 * Renders a fixed left sidebar on desktop (>= md) and a fixed bottom
 * tab bar on mobile — per the brief's navigation requirement.
 *
 * Shared by Owner, Manager, and Waiter dashboards (and Superadmin,
 * which is exempt from restaurant theming — see useRestaurantTheme),
 * so applying the Owner-set theme here is what makes it show up
 * consistently across all of those logins, not just the sidebar of
 * whichever one happens to render it first.
 */
export default function DashboardShell({ title, navItems, children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const { style: themeStyle } = useRestaurantTheme();

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  async function handleLogout() {
    const refreshToken = localStorage.getItem('qr-dining-refresh');
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // best-effort — proceed to clear local session regardless
    }
    localStorage.removeItem('qr-dining-refresh');
    logout();
    disconnectSocket(); // drop the authenticated socket immediately, ignore ref-count
    toast.success('Signed out');
    navigate('/login', { replace: true });
  }

  return (
    <div
      className="min-h-screen flex"
      style={{
        ...themeStyle,
        backgroundColor: 'var(--staff-body)',
        fontFamily: 'var(--staff-font)',
        fontSize: 'var(--staff-font-size)',
      }}
    >
      {/* --- Desktop sidebar --- */}
      <aside
        className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-line h-screen sticky top-0"
        style={{ backgroundColor: 'var(--staff-header)' }}
      >
        <div className="px-5 py-5 border-b border-line flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-widest staff-menu-accent uppercase">
              QR Dining
            </p>
            <h2 className="font-display text-lg text-ink leading-tight">{title}</h2>
          </div>
          <button
            onClick={toggleSound}
            className="text-slate hover:text-ink mt-0.5"
            title={soundOn ? 'Mute alert sounds' : 'Unmute alert sounds'}
          >
            {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'staff-menu-active'
                    : 'text-ink/70 hover:bg-paper-dim hover:text-ink'
                }`
              }
            >
              {Icon && <Icon size={16} />}
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-line">
          <p className="px-3 text-xs text-slate mb-2 truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-chili hover:bg-chili-soft transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* --- Main content --- */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <header
          className="md:hidden sticky top-0 z-10 border-b border-line px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: 'var(--staff-header)' }}
        >
          <h2 className="font-display text-lg text-ink">{title}</h2>
          <div className="flex items-center gap-3">
            <button onClick={toggleSound} className="text-slate" title="Toggle alert sounds">
              {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={handleLogout} className="text-chili">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        {children}
      </main>

      {/* --- Mobile bottom nav --- */}
      {/* Scrolls horizontally rather than squeezing every tab to fit,
          since some dashboards (Owner) now have more items than a phone
          screen can show at readable size. */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 border-t border-line flex items-stretch overflow-x-auto z-20"
        style={{ backgroundColor: 'var(--staff-header)' }}
      >
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `shrink-0 w-16 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium ${
                isActive ? 'staff-menu-accent' : 'text-slate'
              }`
            }
          >
            {Icon && <Icon size={18} />}
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
