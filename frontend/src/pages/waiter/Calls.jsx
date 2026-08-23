import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Bell, Receipt, Check } from 'lucide-react';

import { waiterApi } from '@/api/waiter';
import { useSocket } from '@/sockets/useSocket';
import { playNotificationSound } from '@/utils/sound';

const TYPE_META = {
  CALL_WAITER: { icon: Bell, label: 'Called waiter' },
  REQUEST_BILL: { icon: Receipt, label: 'Requested bill' },
  ASSISTANCE: { icon: Bell, label: 'Needs assistance' },
};

export default function Calls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    waiterApi
      .listCalls()
      .then(setCalls)
      .catch(() => toast.error('Failed to load calls'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useSocket({
    'waiter-call:new': (call) => {
      load();
      playNotificationSound('call');
      const meta = TYPE_META[call.type] || TYPE_META.CALL_WAITER;
      toast(`${meta.label} — Table ${call.table?.tableNumber ?? ''}`, { icon: '🔔' });
    },
    'waiter-call:update': load,
  });

  async function handleAcknowledge(id) {
    try {
      await waiterApi.acknowledgeCall(id);
      load();
    } catch {
      toast.error('Failed to acknowledge');
    }
  }

  async function handleResolve(id) {
    try {
      await waiterApi.resolveCall(id);
      setCalls((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error('Failed to resolve');
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="font-display text-2xl text-ink mb-1">Calls</h1>
      <p className="text-sm text-slate mb-4">Call Waiter and Request Bill notifications.</p>

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : calls.length === 0 ? (
        <p className="text-sm text-slate">No open calls.</p>
      ) : (
        <div className="space-y-3">
          {calls.map((c) => {
            const meta = TYPE_META[c.type] || TYPE_META.CALL_WAITER;
            const Icon = meta.icon;
            return (
              <div
                key={c.id}
                className={`ticket-edge bg-white border rounded-ticket p-4 mt-2 flex items-center justify-between ${
                  c.status === 'ACKNOWLEDGED' ? 'border-line' : 'border-saffron'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-saffron/15 flex items-center justify-center text-saffron-dark">
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      Table {c.table?.tableNumber} — {meta.label}
                    </p>
                    <p className="text-xs text-slate">
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {c.status === 'ACKNOWLEDGED' && ' · Acknowledged'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {c.status === 'PENDING' && (
                    <button
                      onClick={() => handleAcknowledge(c.id)}
                      className="text-xs font-medium border border-line rounded px-3 py-1.5 hover:border-ink"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleResolve(c.id)}
                    className="flex items-center gap-1 text-xs font-medium bg-basil text-white rounded px-3 py-1.5"
                  >
                    <Check size={13} /> Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
