import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Banknote, Check, Wallet } from 'lucide-react';

import { waiterApi } from '@/api/waiter';
import { useSocket } from '@/sockets/useSocket';
import { playNotificationSound } from '@/utils/sound';
import SettlePaymentModal from '@/components/waiter/SettlePaymentModal';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null);
  const [settleTable, setSettleTable] = useState(null);

  const load = useCallback(() => {
    Promise.all([waiterApi.listPendingPayments(), waiterApi.listTables()])
      .then(([p, t]) => {
        setPayments(p);
        setTables(t);
      })
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
    'table:update': load,
    'order:new': load,
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

  const tablesWithBalance = tables.filter((t) => t.session && Number(t.session.totalAmount) > 0);

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="font-display text-2xl text-ink mb-1">Payment Confirmations</h1>
      <p className="text-sm text-slate mb-4">
        Confirm cash a customer requested from their phone, or settle a table you served
        manually — either way, the table frees up automatically once paid.
      </p>

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : (
        <>
          {/* --- Settle a table directly (no customer QR checkout involved) --- */}
          {tablesWithBalance.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">
                Tables with a balance due
              </p>
              <div className="space-y-2">
                {tablesWithBalance.map((t) => (
                  <div
                    key={t.id}
                    className="ticket-edge bg-white border border-line rounded-ticket p-3 mt-2 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">Table {t.tableNumber}</p>
                      <p className="font-mono text-sm text-slate">
                        ₹{Number(t.session.totalAmount).toFixed(2)} due
                      </p>
                    </div>
                    <button
                      onClick={() => setSettleTable(t)}
                      className="flex items-center gap-1.5 bg-ink text-paper rounded px-3 py-2 text-sm font-medium shrink-0"
                    >
                      <Wallet size={15} /> Settle
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- Customer-initiated pending payments --- */}
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">
            Customer requested (pending confirmation)
          </p>
          {payments.length === 0 ? (
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
        </>
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
