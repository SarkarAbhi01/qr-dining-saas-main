import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock } from 'lucide-react';

import { waiterApi } from '@/api/waiter';
import { useSocket } from '@/sockets/useSocket';
import { playNotificationSound } from '@/utils/sound';

export default function ServiceQueue() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    waiterApi
      .serviceQueue()
      .then(setOrders)
      .catch(() => toast.error('Failed to load service queue'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useSocket({
    'order:ready': () => {
      load();
      playNotificationSound('orderReady');
      toast('An order is ready to serve', { icon: '🛎️' });
    },
    'order:update': load,
    'order:new': load,
  });

  async function handleServed(orderId) {
    try {
      await waiterApi.markServed(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success('Marked served');
    } catch {
      toast.error('Failed to update order');
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="font-display text-2xl text-ink mb-1">Service Queue</h1>
      <p className="text-sm text-slate mb-4">Orders the kitchen has marked ready to serve.</p>

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate">Nothing waiting right now.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="ticket-edge bg-white border border-basil/30 rounded-ticket p-4 mt-2 flex items-center justify-between">
              <div>
                <p className="font-display text-lg text-ink">Table {o.table?.tableNumber}</p>
                <p className="text-xs text-slate flex items-center gap-1 mt-0.5">
                  <Clock size={12} />
                  Ready since {new Date(o.readyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-slate mt-1">
                  {o.items?.map((i) => `${i.quantity}× ${i.menuItem?.name}`).join(', ')}
                </p>
              </div>
              <button
                onClick={() => handleServed(o.id)}
                className="flex items-center gap-1.5 bg-basil text-white rounded px-3 py-2 text-sm font-medium hover:opacity-90 shrink-0"
              >
                <CheckCircle2 size={15} /> Served
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
