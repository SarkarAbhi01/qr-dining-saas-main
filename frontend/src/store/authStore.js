import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Roles mirror the Prisma UserRole enum exactly.
export const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CHEF: 'CHEF',
  WAITER: 'WAITER',
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null, // { id, name, email, role, restaurantId }
      accessToken: null,

      setSession: (user, accessToken) => set({ user, accessToken }),

      logout: () => set({ user: null, accessToken: null }),

      // Convenience getters used across role-gated routes/components
      hasRole: (...roles) => {
        const current = get().user?.role;
        return current ? roles.includes(current) : false;
      },
    }),
    {
      name: 'qr-dining-auth', // localStorage key
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
);
