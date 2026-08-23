import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';
import StatCard from '@/components/StatCard';

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superadminApi
      .overview()
      .then(setStats)
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to load overview'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-slate text-sm">Loading platform overview…</div>;
  if (!stats) return null;

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="font-display text-2xl text-ink mb-1">Platform Overview</h1>
      <p className="text-sm text-slate mb-6">Snapshot across every restaurant on the platform.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Restaurants" value={stats.activeRestaurants} accent="basil" />
        <StatCard label="Trial Restaurants" value={stats.trialRestaurants} accent="saffron" />
        <StatCard label="Suspended" value={stats.suspendedRestaurants} accent="chili" />
        <StatCard label="Total Restaurants" value={stats.totalRestaurants} />
        <StatCard
          label="Total Orders Processed"
          value={stats.totalOrdersProcessed.toLocaleString()}
          accent="cobalt"
        />
        <StatCard
          label="Total Revenue"
          value={`₹${Number(stats.totalRevenue).toLocaleString()}`}
          accent="basil"
        />
        <StatCard
          label="New Restaurants (30d)"
          value={stats.newRestaurantsLast30Days}
          hint="Signed up in the last 30 days"
        />
      </div>
    </div>
  );
}
