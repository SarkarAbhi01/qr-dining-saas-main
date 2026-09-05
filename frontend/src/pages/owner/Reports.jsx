import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

import { reportsApi } from '@/api/reports';
import StatCard from '@/components/StatCard';

const RANGE_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '12m', label: '12 months' },
];

const METHOD_LABEL = {
  CASH: 'Cash',
  UPI: 'UPI',
  CARD: 'Card',
  STRIPE: 'Online (Card)',
  RAZORPAY: 'Online (Razorpay)',
  WALLET: 'Wallet',
  OTHER: 'Other',
};

const METHOD_COLOR = {
  CASH: 'bg-basil',
  UPI: 'bg-cobalt',
  CARD: 'bg-saffron',
  STRIPE: 'bg-saffron',
  RAZORPAY: 'bg-saffron',
  WALLET: 'bg-chili',
  OTHER: 'bg-slate',
};

function formatBucketLabel(dateStr, range) {
  const d = new Date(dateStr);
  return range === '12m'
    ? d.toLocaleDateString([], { month: 'short' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Reports() {
  const [overview, setOverview] = useState(null);
  const [range, setRange] = useState('7d');
  const [revenue, setRevenue] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [staff, setStaff] = useState([]);
  const [chefs, setChefs] = useState([]);
  const [payments, setPayments] = useState({ summary: [], recent: [] });
  const [methodBreakdown, setMethodBreakdown] = useState({ breakdown: [], totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const reportRange = range === '12m' ? '90d' : range === '7d' ? '7d' : '30d';
    Promise.all([
      reportsApi.overview(),
      reportsApi.revenueSeries(range),
      reportsApi.topItems({ limit: 8, range: reportRange }),
      reportsApi.peakHours(),
      reportsApi.staffPerformance(),
      reportsApi.chefPerformance(reportRange),
      reportsApi.paymentsCollected(reportRange),
      reportsApi.revenueByMethod(reportRange),
    ])
      .then(([ov, rev, items, hours, staffData, chefData, paymentsData, methodData]) => {
        setOverview(ov);
        setRevenue(rev);
        setTopItems(items);
        setPeakHours(hours);
        setStaff(staffData);
        setChefs(chefData.summary);
        setPayments(paymentsData);
        setMethodBreakdown(methodData);
      })
      .catch(() => toast.error('Failed to load reports'))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading && !overview) return <div className="p-6 text-sm text-slate">Loading reports…</div>;

  const revenueChartData = revenue.map((r) => ({ label: formatBucketLabel(r.date, range), revenue: r.revenue }));
  const peakHoursData = peakHours.map((h) => ({
    label: h.hour === 0 ? '12am' : h.hour < 12 ? `${h.hour}am` : h.hour === 12 ? '12pm' : `${h.hour - 12}pm`,
    orders: h.orders,
  }));
  const maxItemRevenue = Math.max(1, ...topItems.map((i) => i.revenue));

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="font-display text-2xl text-ink mb-1">Reports &amp; Analytics</h1>
      <p className="text-sm text-slate mb-6">Revenue, top sellers, peak hours, and staff performance.</p>

      {/* --- Quick stats --- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Today's Revenue" value={`₹${overview.todayRevenue.toLocaleString()}`} accent="basil" />
        <StatCard label="This Week" value={`₹${overview.weekRevenue.toLocaleString()}`} accent="cobalt" />
        <StatCard label="This Month" value={`₹${overview.monthRevenue.toLocaleString()}`} accent="saffron" />
        <StatCard label="Avg Order Value" value={`₹${overview.avgOrderValue.toFixed(0)}`} />
        <StatCard
          label="Avg Kitchen Time"
          value={overview.avgKitchenPrepMinutes != null ? `${overview.avgKitchenPrepMinutes}m` : '—'}
        />
      </div>

      {/* --- Revenue chart --- */}
      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-slate uppercase tracking-wide">Revenue</p>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  range === opt.value ? 'staff-menu-active' : 'text-slate hover:bg-paper-dim'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={revenueChartData}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-saffron)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-saffron)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-slate)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-slate)' }} axisLine={false} tickLine={false} width={45} />
              <Tooltip
                formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']}
                contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: 'var(--color-line)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-saffron-dark)" fill="url(#revenueFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* --- Top items --- */}
        <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">Top Selling Items</p>
          {topItems.length === 0 ? (
            <p className="text-sm text-slate">No sales yet.</p>
          ) : (
            <div className="space-y-3">
              {topItems.map((item, idx) => (
                <div key={item.menuItemId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ink">
                      <span className="text-slate font-mono text-xs mr-1.5">{idx + 1}.</span>
                      {item.name}
                    </span>
                    <span className="font-mono text-xs text-slate">{item.quantitySold} sold</span>
                  </div>
                  <div className="h-1.5 bg-paper-dim rounded-full overflow-hidden">
                    <div
                      className="h-full bg-saffron rounded-full"
                      style={{ width: `${(item.revenue / maxItemRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* --- Peak hours --- */}
        <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">Peak Hours (30d)</p>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: 'var(--color-slate)' }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-slate)' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [v, 'Orders']}
                  contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: 'var(--color-line)' }}
                />
                <Bar dataKey="orders" fill="var(--color-cobalt)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* --- Waiter performance --- */}
      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-6">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">Waiter Performance</p>
        {staff.length === 0 ? (
          <p className="text-sm text-slate">No waiter accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate uppercase tracking-wide">
                  <th className="pb-2 font-medium">Waiter</th>
                  <th className="pb-2 font-medium text-right">Orders Taken</th>
                  <th className="pb-2 font-medium text-right">Tables Served</th>
                  <th className="pb-2 font-medium text-right">Calls Attended</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="py-2.5">
                      <p className="text-ink">{s.name}</p>
                      {!s.isActive && <span className="text-[10px] text-chili">Inactive</span>}
                    </td>
                    <td className="py-2.5 text-right font-mono">{s.ordersTaken}</td>
                    <td className="py-2.5 text-right font-mono">{s.tablesServed}</td>
                    <td className="py-2.5 text-right font-mono">{s.callsAttended}</td>
                    <td className="py-2.5 text-right font-mono">₹{s.revenueGenerated.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- Chef performance --- */}
      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-6">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">Chef Performance</p>
        {chefs.length === 0 ? (
          <p className="text-sm text-slate">No chef accounts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate uppercase tracking-wide">
                <th className="pb-2 font-medium">Chef</th>
                <th className="pb-2 font-medium text-right">Orders Accepted</th>
                <th className="pb-2 font-medium text-right">Orders Completed</th>
              </tr>
            </thead>
            <tbody>
              {chefs.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-2.5">
                    <p className="text-ink">{c.name}</p>
                    {!c.isActive && <span className="text-[10px] text-chili">Inactive</span>}
                  </td>
                  <td className="py-2.5 text-right font-mono">{c.ordersAccepted}</td>
                  <td className="py-2.5 text-right font-mono">{c.ordersCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Revenue by payment method --- */}
      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-6">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">
          Revenue by Payment Method
        </p>
        {methodBreakdown.breakdown.length === 0 ? (
          <p className="text-sm text-slate">No payments confirmed in this period.</p>
        ) : (
          <div className="space-y-3">
            {methodBreakdown.breakdown.map((m) => (
              <div key={m.method}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-ink font-medium">{METHOD_LABEL[m.method] || m.method}</span>
                  <span className="font-mono text-xs text-slate">
                    ₹{m.revenue.toLocaleString()} · {m.paymentCount} payment{m.paymentCount === 1 ? '' : 's'} ·{' '}
                    {m.percentOfTotal}%
                  </span>
                </div>
                <div className="h-1.5 bg-paper-dim rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${METHOD_COLOR[m.method] || 'bg-ink'}`}
                    style={{ width: `${m.percentOfTotal}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Payments collected --- */}
      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">Payments Collected</p>
        {payments.summary.length === 0 ? (
          <p className="text-sm text-slate">No cash payments confirmed in this period.</p>
        ) : (
          <>
            <table className="w-full text-sm mb-5">
              <thead>
                <tr className="text-left text-xs text-slate uppercase tracking-wide">
                  <th className="pb-2 font-medium">Collected By</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium text-right">Payments</th>
                  <th className="pb-2 font-medium text-right">Total Collected</th>
                </tr>
              </thead>
              <tbody>
                {payments.summary.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2.5 text-ink">{p.name}</td>
                    <td className="py-2.5 text-slate">{p.role}</td>
                    <td className="py-2.5 text-right font-mono">{p.count}</td>
                    <td className="py-2.5 text-right font-mono">₹{p.totalCollected.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-[11px] font-semibold text-slate uppercase tracking-wide mb-2">Recent Payments</p>
            <div className="space-y-1.5">
              {payments.recent.slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs text-slate">
                  <span>
                    Table {p.tableNumber ?? '—'} · {p.collectedBy?.name ?? 'Unknown'}
                  </span>
                  <span className="font-mono">
                    ₹{p.amount.toLocaleString()} · {new Date(p.paidAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
