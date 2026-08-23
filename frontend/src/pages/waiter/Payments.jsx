import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Banknote, Check } from 'lucide-react';

import { waiterApi } from '@/api/waiter';
import { useSocket } from '@/sockets/useSocket';
import { playNotificationSound } from '@/utils/sound';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(() => {
    waiterApi
      .listPendingPayments()
      .then(setPayments)
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useSocket({
    'payment:requested': () => {
      load();
      playNotificationSound('payment');
      toast('A table is ready to pay', { icon: '💵' });
    },
    'payment:confirmed': load,
  });

  async function handleConfirm(id) {
    setConfirming(id);
    try {
      const { sessionClosed } = await waiterApi.confirmPayment(id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      toast.success(sessionClosed ? 'Table settled and freed up' : 'Payment confirmed');
    } catch {
      toast.error('Failed to confirm payment');
    } finally {
      setConfirming(null);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="font-display text-2xl text-ink mb-1">Pending Payments</h1>
      <p className="text-sm text-slate mb-4">Confirm once you've collected cash from the table.</p>

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-slate">No payments waiting for collection.</p>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="ticket-edge bg-white border border-saffron/30 rounded-ticket p-4 mt-2 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-saffron/15 flex items-center justify-center text-saffron-dark">
                  <Banknote size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">
                    Table {p.diningSession?.table?.tableNumber}
                    {p.billSplitShare?.label ? ` — ${p.billSplitShare.label}` : ''}
                  </p>
                  <p className="font-mono text-lg text-ink">₹{Number(p.amount).toFixed(2)}</p>
                </div>
              </div>
              <button
                onClick={() => handleConfirm(p.id)}
                disabled={confirming === p.id}
                className="flex items-center gap-1.5 bg-basil text-white rounded px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
              >
                <Check size={15} /> {confirming === p.id ? 'Confirming…' : 'Collected'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
