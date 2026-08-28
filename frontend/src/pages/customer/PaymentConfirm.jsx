import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

import { customerApi } from '@/api/customer';

export default function PaymentConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking'); // checking | paid | cancelled | failed

  const stripeSessionId = params.get('session_id');
  const cancelled = params.get('cancelled');
  const slug = params.get('slug');
  const tableId = params.get('table');
  const tableUrl = slug && tableId ? `/order/${slug}/${tableId}/orders` : null;

  useEffect(() => {
    if (cancelled) {
      setStatus('cancelled');
      return;
    }
    if (!stripeSessionId) {
      setStatus('failed');
      return;
    }
    customerApi
      .confirmOnlinePayment(stripeSessionId)
      .then((data) => setStatus(data.paid ? 'paid' : 'failed'))
      .catch(() => setStatus('failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once confirmed paid, hand the customer back to their table view
  // (which will show the "bill settled" screen if fully paid) after a
  // brief moment so the success message actually gets read.
  useEffect(() => {
    if (status === 'paid' && tableUrl) {
      const t = setTimeout(() => navigate(tableUrl, { replace: true }), 2000);
      return () => clearTimeout(t);
    }
  }, [status, tableUrl, navigate]);

  function goBack() {
    if (tableUrl) navigate(tableUrl, { replace: true });
    else navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-paper">
      {status === 'checking' && (
        <>
          <Loader2 className="text-slate animate-spin mb-3" size={36} />
          <p className="text-sm text-slate">Confirming your payment…</p>
        </>
      )}

      {status === 'paid' && (
        <>
          <CheckCircle2 className="text-basil mb-3" size={40} />
          <h2 className="font-display text-2xl text-ink mb-1">Payment received</h2>
          <p className="text-sm text-slate max-w-xs">
            Thanks! Your payment went through. Taking you back to your table…
          </p>
        </>
      )}

      {status === 'cancelled' && (
        <>
          <XCircle className="text-slate mb-3" size={36} />
          <h2 className="font-display text-2xl text-ink mb-1">Payment cancelled</h2>
          <p className="text-sm text-slate max-w-xs mb-4">
            No charge was made. You can try again or ask your waiter to collect cash instead.
          </p>
          <button onClick={goBack} className="text-sm text-cobalt underline">
            Go back
          </button>
        </>
      )}

      {status === 'failed' && (
        <>
          <XCircle className="text-chili mb-3" size={36} />
          <h2 className="font-display text-2xl text-ink mb-1">Couldn't confirm payment</h2>
          <p className="text-sm text-slate max-w-xs mb-4">
            We couldn't verify this payment. If money was deducted, please show this screen to your
            waiter — otherwise, try again or pay by cash.
          </p>
          <button onClick={goBack} className="text-sm text-cobalt underline">
            Go back
          </button>
        </>
      )}
    </div>
  );
}
