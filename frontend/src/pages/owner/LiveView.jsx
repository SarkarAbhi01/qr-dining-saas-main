import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

import { waiterApi } from '@/api/waiter';
import { kdsApi } from '@/api/kds';
import { useSocket } from '@/sockets/useSocket';
import StatCard from '@/components/StatCard';

const STATUS_STYLES = {
  EMPTY: 'bg-basil-soft border-basil text-basil',
  OCCUPIED: 'bg-chili-soft border-chili text-chili',
  NEEDS_ATTENTION: 'bg-saffron/15 border-saffron text-saffron-dark animate-pulse',
  RESERVED: 'bg-cobalt-soft border-cobalt text-cobalt',
};

export default function LiveView() {
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([waiterApi.listTables(), kdsApi.listActiveOrders()])
      .then(([t, o]) => {
        setTables(t);
        setOrders(o);
      })
      .catch(() => toast.error('Failed to load live view'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useSocket({
    'table:update': load,
    'order:new': load,
    'order:update': load,
    'waiter-call:new': load,
    'waiter-call:update': load,
  });

  const occupied = tables.filter((t) => t.status !== 'EMPTY').length;
  const needsAttention = tables.filter((t) => t.status === 'NEEDS_ATTENTION').length;

  if (loading) return <div className="p-6 text-sm text-slate">Loading live view…</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <h1 className="font-display text-2xl text-ink mb-1">Live View</h1>
      <p className="text-sm text-slate mb-6">Real-time occupancy and active orders.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Occupied Tables" value={`${occupied}/${tables.length}`} accent="chili" />
        <StatCard label="Needs Attention" value={needsAttention} accent="saffron" />
        <StatCard label="Active Orders" value={orders.length} accent="cobalt" />
      </div>

      <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Occupancy</p>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-6">
        {tables.map((t) => (
          <div
            key={t.id}
            className={`aspect-square rounded-ticket border-2 flex items-center justify-center font-display text-lg ${STATUS_STYLES[t.status]}`}
          >
            {t.tableNumber}
          </div>
        ))}
      </div>

      <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Active Orders</p>
      {orders.length === 0 ? (
        <p className="text-sm text-slate">No orders in flight.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="ticket-edge bg-white border border-line rounded-ticket p-3 mt-2 flex items-center justify-between text-sm">
              <span className="font-medium text-ink">Table {o.table?.tableNumber}</span>
              <span className="text-slate">{o.items?.length} item(s)</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-paper-dim">{o.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
