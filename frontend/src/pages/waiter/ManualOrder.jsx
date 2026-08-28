import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Minus } from 'lucide-react';

import { waiterApi } from '@/api/waiter';

export default function ManualOrder() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState({}); // menuItemId -> { item, quantity }
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    waiterApi
      .getMenu()
      .then(setCategories)
      .catch(() => toast.error('Failed to load menu'));
  }, []);

  function adjustQty(item, delta) {
    setCart((prev) => {
      const current = prev[item.id]?.quantity || 0;
      const next = Math.max(0, current + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[item.id];
      else copy[item.id] = { item, quantity: next };
      return copy;
    });
  }

  const cartItems = Object.values(cart);
  const total = cartItems.reduce((sum, { item, quantity }) => sum + Number(item.price) * quantity, 0);

  async function handleSubmit() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      await waiterApi.createManualOrder({
        tableId,
        items: cartItems.map(({ item, quantity }) => ({
          menuItemId: item.id,
          quantity,
          modifierOptionIds: [],
        })),
      });
      toast.success('Order sent to kitchen');
      navigate('/waiter');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl pb-28">
      <button onClick={() => navigate('/waiter')} className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink mb-4">
        <ArrowLeft size={14} /> Tables
      </button>
      <h1 className="font-display text-2xl text-ink mb-4">Manual order</h1>

      {categories.map((cat) => (
        <div key={cat.id} className="mb-5">
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">{cat.name}</p>
          <div className="space-y-2">
            {cat.menuItems.map((item) => {
              const qty = cart[item.id]?.quantity || 0;
              return (
                <div
                  key={item.id}
                  className="ticket-edge bg-white border border-line rounded-ticket p-3 mt-2 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{item.name}</p>
                    <p className="text-xs text-slate">₹{Number(item.price).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustQty(item, -1)}
                      disabled={qty === 0}
                      className="w-7 h-7 rounded-full border border-line flex items-center justify-center disabled:opacity-30"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-5 text-center text-sm font-mono">{qty}</span>
                    <button
                      onClick={() => adjustQty(item, 1)}
                      className="staff-menu-btn w-7 h-7 rounded-full flex items-center justify-center"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {cartItems.length > 0 && (
        <div className="fixed bottom-16 md:bottom-0 inset-x-0 md:relative md:mt-6 bg-white border-t md:border md:border-line md:rounded-ticket p-4 flex items-center justify-between shadow-lg md:shadow-none">
          <div>
            <p className="text-xs text-slate">{cartItems.length} item(s)</p>
            <p className="font-display text-lg text-ink">₹{total.toFixed(2)}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="staff-menu-btn rounded px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send to kitchen'}
          </button>
        </div>
      )}
    </div>
  );
}
