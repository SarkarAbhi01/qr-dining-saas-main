import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';

import { waiterApi } from '@/api/waiter';
import { useSocket } from '@/sockets/useSocket';
import SettlePaymentModal from '@/components/waiter/SettlePaymentModal';

const STATUS_STYLES = {
  EMPTY: 'bg-basil-soft border-basil text-basil',
  OCCUPIED: 'bg-chili-soft border-chili text-chili',
  NEEDS_ATTENTION: 'bg-saffron/15 border-saffron text-saffron-dark animate-pulse',
  RESERVED: 'bg-cobalt-soft border-cobalt text-cobalt',
};

const STATUS_LABEL = {
  EMPTY: 'Empty',
  OCCUPIED: 'Occupied',
  NEEDS_ATTENTION: 'Needs attention',
  RESERVED: 'Reserved',
};

export default function TableGrid() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myStats, setMyStats] = useState(null);
  const [settleTable, setSettleTable] = useState(null);

  const load = useCallback(() => {
    waiterApi
      .listTables()
      .then(setTables)
      .catch(() => toast.error('Failed to load tables'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    // Silently ignored if the Owner hasn't granted report access.
    waiterApi.myPerformance().then(setMyStats).catch(() => {});
  }, []);

  useSocket({
    'table:update': (updated) => {
      setTables((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
    },
    'waiter-call:new': () => load(),
    'waiter-call:update': () => load(),
    'order:new': () => load(),
    'order:update': () => load(),
    'payment:confirmed': () => load(),
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-ink">Tables</h1>
        {myStats && (
          <span className="text-[11px] font-mono text-slate bg-paper-dim px-2 py-1 rounded-full">
            You today: {myStats.callsAttended} calls · {myStats.tablesServed} served
          </span>
        )}
      </div>
      <p className="text-sm text-slate mb-4">
        Tap a table to take a manual order, or the wallet icon to collect payment.
      </p>

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {tables.map((t) => {
            const hasBalance = t.session && Number(t.session.totalAmount) > 0;
            return (
              <div key={t.id} className="relative">
                <Link
                  to={`/waiter/order/${t.id}`}
                  className={`aspect-square rounded-ticket border-2 flex flex-col items-center justify-center gap-1 ${STATUS_STYLES[t.status]}`}
                >
                  <span className="font-display text-2xl leading-none">{t.tableNumber}</span>
                  <span className="text-[10px] font-medium uppercase tracking-wide">
                    {STATUS_LABEL[t.status]}
                  </span>
                  {t.session?.hasReadyOrder && (
                    <span className="text-[10px] font-semibold bg-basil text-white px-1.5 py-0.5 rounded-full">
                      Ready
                    </span>
                  )}
                </Link>
                {hasBalance && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSettleTable(t);
                    }}
                    title={`Collect payment — ₹${Number(t.session.totalAmount).toFixed(2)} due`}
                    className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center shadow-md"
                  >
                    <Wallet size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SettlePaymentModal
        open={!!settleTable}
        onClose={() => setSettleTable(null)}
        table={settleTable}
        onSettled={load}
      />
    </div>
  );
}
