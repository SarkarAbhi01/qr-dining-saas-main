import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';
import StatCard from '@/components/StatCard';

const RANGE_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const MODEL_STYLES = {
  COMMISSION: 'bg-saffron/15 text-saffron-dark',
  MONTHLY_FEE: 'bg-cobalt-soft text-cobalt',
};

const MODEL_LABEL = {
  COMMISSION: 'Commission',
  MONTHLY_FEE: 'Fixed fee',
};

export default function Revenue() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    superadminApi
      .restaurantRevenueReport(days)
      .then(setRows)
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load revenue report'))
      .finally(() => setLoading(false));
  }, [days]);

  const commissionRestaurants = rows.filter((r) => r.revenueModel === 'COMMISSION');
  const monthlyFeeRestaurants = rows.filter((r) => r.revenueModel === 'MONTHLY_FEE');
  const totalCommissionEarned = commissionRestaurants.reduce(
    (sum, r) => sum + (r.estimatedCommissionEarned || 0),
    0
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-ink mb-1">Revenue by Restaurant</h1>
          <p className="text-sm text-slate">
            Who's on Commission vs. a Fixed Plan, and what each has generated.
          </p>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors ${
                days === opt.value ? 'bg-ink text-paper' : 'text-slate hover:bg-paper-dim'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="On Commission" value={commissionRestaurants.length} accent="saffron" />
        <StatCard label="On Fixed Fee" value={monthlyFeeRestaurants.length} accent="cobalt" />
        <StatCard
          label="Commission Earned"
          value={`₹${totalCommissionEarned.toLocaleString()}`}
          accent="basil"
          hint={`Last ${days} days`}
        />
        <StatCard
          label="Total Restaurant Revenue"
          value={`₹${rows.reduce((s, r) => s + r.totalRevenue, 0).toLocaleString()}`}
          hint={`Last ${days} days`}
        />
      </div>

      <div className="ticket-edge bg-white border border-line rounded-ticket overflow-hidden mt-2">
        {loading ? (
          <p className="p-6 text-sm text-slate">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate">No restaurants yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper-dim text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium text-right">Rate</th>
                <th className="px-4 py-3 font-medium text-right">Revenue ({days}d)</th>
                <th className="px-4 py-3 font-medium text-right">Commission Owed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-paper-dim/50">
                  <td className="px-4 py-3">
                    <Link to={`/superadmin/restaurants/${r.id}`} className="font-medium text-ink hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-xs text-slate font-mono">{r.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MODEL_STYLES[r.revenueModel]}`}>
                      {MODEL_LABEL[r.revenueModel]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate">
                    {r.revenueModel === 'COMMISSION' && r.commissionRatePercent != null
                      ? `${Number(r.commissionRatePercent)}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">₹{r.totalRevenue.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.estimatedCommissionEarned != null ? (
                      <span className="text-basil font-semibold">
                        ₹{r.estimatedCommissionEarned.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-slate">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-slate mt-3">
        "Commission Owed" is an estimate — order revenue collected × this restaurant's commission
        rate — for restaurants on the Commission model. Restaurants on a Fixed Fee plan don't accrue
        commission here; their charge comes from their assigned plan instead.
      </p>
    </div>
  );
}
