import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CreditCard, CheckCircle2, AlertTriangle } from 'lucide-react';

import { billingApi } from '@/api/billing';

const STATUS_META = {
  ACTIVE: { label: 'Active', style: 'bg-basil-soft text-basil' },
  TRIALING: { label: 'Trial', style: 'bg-cobalt-soft text-cobalt' },
  PAST_DUE: { label: 'Past due', style: 'bg-chili-soft text-chili' },
  CANCELLED: { label: 'Cancelled', style: 'bg-paper-dim text-slate' },
};

const INVOICE_STATUS_STYLES = {
  SUCCEEDED: 'bg-basil-soft text-basil',
  PENDING: 'bg-saffron/15 text-saffron-dark',
  FAILED: 'bg-chili-soft text-chili',
  PROCESSING: 'bg-cobalt-soft text-cobalt',
  REFUNDED: 'bg-paper-dim text-slate',
};

function UsageBar({ label, used, max }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const nearLimit = max && used / max >= 0.9;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-ink">{label}</span>
        <span className={`font-mono text-xs ${nearLimit ? 'text-chili' : 'text-slate'}`}>
          {used}
          {max != null ? ` / ${max}` : ''}
        </span>
      </div>
      {max != null && (
        <div className="h-1.5 bg-paper-dim rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${nearLimit ? 'bg-chili' : 'bg-saffron'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  const [billing, setBilling] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([billingApi.get(), billingApi.listInvoices()])
      .then(([b, inv]) => {
        setBilling(b);
        setInvoices(inv);
      })
      .catch(() => toast.error('Failed to load billing info'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-slate">Loading billing…</div>;
  if (!billing) return null;

  const statusMeta = STATUS_META[billing.subscriptionStatus] || STATUS_META.TRIALING;

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <h1 className="font-display text-2xl text-ink mb-1">Billing</h1>
      <p className="text-sm text-slate mb-6">
        Your subscription plan and usage. To change plans, contact the platform team.
      </p>

      {billing.subscriptionStatus === 'PAST_DUE' && (
        <div className="flex items-start gap-2 bg-chili-soft border border-chili/20 rounded-ticket p-4 mb-4">
          <AlertTriangle className="text-chili shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-ink">
            Your last payment didn't go through. Please reach out to avoid a service interruption.
          </p>
        </div>
      )}

      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-saffron/15 flex items-center justify-center text-saffron-dark">
              <CreditCard size={18} />
            </div>
            <div>
              <p className="font-display text-lg text-ink">{billing.plan?.name || 'No plan assigned'}</p>
              <p className="text-xs text-slate">{billing.plan?.description}</p>
            </div>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusMeta.style}`}>
            {statusMeta.label}
          </span>
        </div>

        {billing.plan && (
          <p className="font-mono text-2xl text-ink mb-1">
            ₹{Number(billing.plan.priceMonthly).toLocaleString()}
            <span className="text-xs text-slate font-sans">/month</span>
          </p>
        )}

        {billing.subscriptionEndsAt && (
          <p className="text-xs text-slate">
            {billing.subscriptionStatus === 'TRIALING' ? 'Trial ends' : 'Renews'}{' '}
            {new Date(billing.subscriptionEndsAt).toLocaleDateString([], {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-4">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Usage</p>
        <div className="space-y-4">
          <UsageBar label="Tables" used={billing.usage.tables} max={billing.usage.maxTables} />
          <UsageBar label="Staff accounts" used={billing.usage.staff} max={billing.usage.maxStaff} />
        </div>
      </div>

      {billing.plan?.features && Object.keys(billing.plan.features).length > 0 && (
        <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-4">
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Plan includes</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(billing.plan.features).map(([key, enabled]) =>
              enabled ? (
                <div key={key} className="flex items-center gap-1.5 text-sm text-ink">
                  <CheckCircle2 size={14} className="text-basil shrink-0" />
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Invoice history</p>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate uppercase tracking-wide">
                <th className="pb-2 font-medium">Period</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-line">
                  <td className="py-2.5 text-ink">
                    {new Date(inv.periodStart).toLocaleDateString([], { month: 'short', day: 'numeric' })} –{' '}
                    {new Date(inv.periodEnd).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-2.5 text-right font-mono">₹{Number(inv.amount).toLocaleString()}</td>
                  <td className="py-2.5 text-right">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${INVOICE_STATUS_STYLES[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
