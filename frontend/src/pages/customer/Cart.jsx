import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { customerApi } from '@/api/customer';
import { useCartStore, cartTotal } from '@/store/cartStore';
import { useCustomerContext } from './CustomerApp';

export default function Cart() {
  const { session, refreshSession } = useCustomerContext();
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart } = useCartStore();
  const [placing, setPlacing] = useState(false);

  const total = cartTotal(items);
  const billRequested = session.status === 'BILL_REQUESTED';

  async function handlePlaceOrder() {
    setPlacing(true);
    try {
      await customerApi.placeOrder(
        session.id,
        items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          portion: i.portion || 'FULL',
          notes: i.notes || undefined,
          modifierOptionIds: i.modifierOptionIds,
        }))
      );
      clearCart();
      await refreshSession();
      toast.success('Order placed — the kitchen has it now');
      navigate('../orders');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="pb-32">
      <div className="px-4 py-3">
        <Link to="../" className="inline-flex items-center gap-1 text-sm text-slate">
          <ArrowLeft size={14} /> Back to menu
        </Link>
      </div>

      {billRequested && (
        <div className="mx-4 mb-3 bg-saffron/15 border border-saffron/30 text-sm text-ink rounded-ticket px-4 py-3">
          The bill's already been requested for this table — ask your waiter if you'd like to add more.
        </div>
      )}

      <div className="px-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate py-10 text-center">Your cart is empty.</p>
        ) : (
          items.map((i) => (
            <div key={i.key} className="ticket-edge bg-white border border-line rounded-ticket p-3 mt-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {i.portion === 'HALF' && <span className="text-slate">Half </span>}
                    {i.name}
                  </p>
                  {i.modifierLabel && <p className="text-xs text-slate">{i.modifierLabel}</p>}
                  {i.notes && <p className="text-xs text-slate italic">"{i.notes}"</p>}
                </div>
                <button onClick={() => removeItem(i.key)} className="text-slate hover:text-chili shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(i.key, i.quantity - 1)}
                    className="w-7 h-7 rounded-full border border-line flex items-center justify-center"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="font-mono text-sm w-4 text-center">{i.quantity}</span>
                  <button
                    onClick={() => updateQuantity(i.key, i.quantity + 1)}
                    className="w-7 h-7 rounded-full border border-line flex items-center justify-center"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <p className="font-mono text-sm text-ink">₹{(i.unitPrice * i.quantity).toFixed(2)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-line px-4 py-4">
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="text-slate">Total</span>
            <span className="font-mono text-lg text-ink">₹{total.toFixed(2)}</span>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={placing || billRequested}
            className="w-full bg-ink text-paper rounded-ticket px-4 py-3.5 text-sm font-medium disabled:opacity-50"
          >
            {placing ? 'Placing order…' : 'Place order'}
          </button>
        </div>
      )}
    </div>
  );
}
