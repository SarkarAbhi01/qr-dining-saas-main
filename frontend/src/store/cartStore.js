import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Cart lines: { key, menuItemId, name, unitPrice, quantity, notes,
 *               modifierOptionIds: string[], modifierLabel: string }
 * `key` disambiguates the same menu item added twice with different
 * modifiers/notes so they don't get merged into one line.
 */
export const useCartStore = create(
  persist(
    (set, get) => ({
      sessionId: null,
      items: [],

      // Wipes the cart if we've moved to a new dining session (e.g. after
      // the bill was paid and the table starts a fresh sitting).
      syncSession: (sessionId) => {
        if (get().sessionId !== sessionId) {
          set({ sessionId, items: [] });
        }
      },

      addItem: (line) =>
        set((state) => {
          const key = `${line.menuItemId}:${line.portion || 'FULL'}:${(line.modifierOptionIds || []).sort().join(',')}:${line.notes || ''}`;
          const existing = state.items.find((i) => i.key === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, quantity: i.quantity + line.quantity } : i
              ),
            };
          }
          return { items: [...state.items, { ...line, key }] };
        }),

      updateQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.key !== key)
              : state.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
        })),

      removeItem: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),

      clearCart: () => set({ items: [] }),
    }),
    { name: 'qr-dining-cart' }
  )
);

export function cartTotal(items) {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

export function cartItemCount(items) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
