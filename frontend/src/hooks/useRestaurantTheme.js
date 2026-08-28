import { useEffect, useState } from 'react';
import { themeApi } from '@/api/theme';
import { useAuthStore, ROLES } from '@/store/authStore';

/**
 * Fetches the logged-in staff member's restaurant theme (read access is
 * granted to every restaurant-scoped role on the backend — see
 * backend/src/routes/theme.routes.js) and returns the CSS variable
 * overrides to apply, plus the raw config in case a page needs it
 * directly. Superadmin has no restaurant to theme, so this is a no-op
 * for that role.
 */
export function useRestaurantTheme() {
  const role = useAuthStore((s) => s.user?.role);
  const [theme, setTheme] = useState({});

  useEffect(() => {
    if (!role || role === ROLES.SUPERADMIN) return;
    themeApi
      .get()
      .then(setTheme)
      .catch(() => {
        /* fall back to product defaults silently — a broken theme fetch
           shouldn't block staff from using their dashboard */
      });
  }, [role]);

  const style = {
    '--staff-body': theme.bodyColor || undefined,
    '--staff-header': theme.headerColor || undefined,
    '--staff-menu': theme.menuColor || undefined,
    '--staff-menu-hover': theme.hoverColor || undefined,
    '--staff-font': theme.fontFamily ? `'${theme.fontFamily}', var(--font-sans)` : undefined,
    '--staff-font-size': theme.fontSize ? `${theme.fontSize}px` : undefined,
  };

  return { theme, style };
}
