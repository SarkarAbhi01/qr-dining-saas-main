import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, Receipt, CheckCircle2, Banknote, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';

import { customerApi } from '@/api/customer';
import { useCustomerContext } from './CustomerApp';
import SplitBillModal from '@/components/customer/SplitBillModal';

const STATUS_STYLES = {
  RECEIVED: 'bg-paper-dim text-slate',
  PREPARING: 'bg-saffron/20 text-saffron-dark',
  READY: 'bg-basil-soft text-basil',
  SERVED: 'bg-cobalt-soft text-cobalt',
  CANCELLED: 'bg-chili-soft text-chili',
};

export default function OrderTracking() {
  const { session: initialSession, refreshSession } = useCustomerContext();
  const [session, setSession] = useState(initialSession);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitResult, setSplitResult] = useState(null);
  const [checkoutRequested, setCheckoutRequested] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  async function load() {
    try {
      const data = await customerApi.getSession(initialSession.id);
      setSession(data.session);
      setOrders(data.orders);
    } catch {
      toast.error('Failed to load your orders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000); // poll for kitchen status + payment updates
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallWaiter() {
    try {
      await customerApi.callWaiter(session.id);
      toast.success('Waiter notified');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to call waiter');
    }
  }

  async function handleRequestBill() {
    try {
      const res = await customerApi.requestBill(session.id);
      if (res.data?.alreadyRequested) {
        toast('Bill already requested', { icon: '🧾' });
      } else {
        toast.success('Bill requested — your waiter is on the way');
      }
      await load();
      await refreshSession();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request bill');
    }
  }

  async function handlePayCash() {
    setCheckingOut(true);
    try {
      await customerApi.checkoutCash(session.id);
      setCheckoutRequested(true);
      toast.success('A waiter is on the way to collect payment');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start checkout');
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) return <p className="p-6 text-sm text-slate">Loading your orders…</p>;

  // Session fully paid and closed — nothing left to do here.
  if (session.status === 'CLOSED') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
        <PartyPopper className="text-saffron-dark mb-3" size={40} />
        <h2 className="font-display text-2xl text-ink mb-1">Thanks for dining with us!</h2>
        <p className="text-sm text-slate">Your bill is settled. See you again soon.</p>
      </div>
    );
  }

  const total = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const billRequested = session.status === 'BILL_REQUESTED';

  return (
    <div className="pb-28">
      <div className="px-4 py-3">
        <Link to="../" className="inline-flex items-center gap-1 text-sm text-slate">
          <ArrowLeft size={14} /> Back to menu
        </Link>
      </div>

      <div className="px-4 space-y-4">
        {orders.length === 0 && <p className="text-sm text-slate py-10 text-center">No orders placed yet.</p>}

        {orders.map((order, idx) => (
          <div key={order.id} className="ticket-edge bg-white border border-line rounded-ticket p-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono text-slate">Order #{idx + 1}</p>
              <p className="text-xs text-slate">{new Date(order.placedAt).toLocaleTimeString()}</p>
            </div>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    {item.quantity}× {item.menuItem?.name}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[item.status]}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-2 pt-2 border-t border-line">
              <p className="font-mono text-sm text-ink">₹{Number(order.totalAmount).toFixed(2)}</p>
            </div>
          </div>
        ))}

        {orders.length > 0 && (
          <div className="ticket-edge bg-white border border-line rounded-ticket p-4 mt-2 flex justify-between items-center">
            <span className="text-sm font-medium text-ink">Running total</span>
            <span className="font-mono text-lg text-ink">₹{total.toFixed(2)}</span>
          </div>
        )}

        {splitResult && (
          <div className="flex items-start gap-2 bg-basil-soft border border-basil/20 rounded-ticket p-4">
            <CheckCircle2 className="text-basil shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-ink">
              Split confirmed ({splitResult.splitType.toLowerCase()}) — pay each share in cash when your
              waiter arrives.
            </p>
          </div>
        )}

        {checkoutRequested && (
          <div className="flex items-start gap-2 bg-saffron/10 border border-saffron/30 rounded-ticket p-4">
            <Banknote className="text-saffron-dark shrink-0 mt-0.5" size={16} />
            <p className="text-sm text-ink">
              Have your cash ready — a waiter has been notified and is on the way to collect payment.
            </p>
          </div>
        )}
      </div>

      {orders.length > 0 && !checkoutRequested && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-line px-4 py-3 flex gap-2">
          <button
            onClick={handleCallWaiter}
            className="flex-1 flex items-center justify-center gap-1.5 border border-line rounded-ticket px-3 py-3 text-sm font-medium"
          >
            <Bell size={15} /> Call waiter
          </button>
          {billRequested ? (
            <>
              <button
                onClick={() => setSplitOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 border border-line rounded-ticket px-3 py-3 text-sm font-medium"
              >
                <Receipt size={15} /> Split
              </button>
              <button
                onClick={handlePayCash}
                disabled={checkingOut}
                className="flex-1 flex items-center justify-center gap-1.5 bg-ink text-paper rounded-ticket px-3 py-3 text-sm font-medium disabled:opacity-50"
              >
                <Banknote size={15} /> {checkingOut ? 'Please wait…' : 'Pay cash'}
              </button>
            </>
          ) : (
            <button
              onClick={handleRequestBill}
              className="flex-1 flex items-center justify-center gap-1.5 bg-ink text-paper rounded-ticket px-3 py-3 text-sm font-medium"
            >
              <Receipt size={15} /> Request bill
            </button>
          )}
        </div>
      )}

      <SplitBillModal
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        sessionId={session.id}
        total={total}
        onSplit={setSplitResult}
      />
    </div>
  );
}
