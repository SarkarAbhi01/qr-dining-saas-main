import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';
import CreateRestaurantModal from '@/components/CreateRestaurantModal';
import CredentialRevealModal from '@/components/CredentialRevealModal';

const STATUS_STYLES = {
  ACTIVE: 'bg-basil-soft text-basil',
  TRIAL: 'bg-cobalt-soft text-cobalt',
  SUSPENDED: 'bg-chili-soft text-chili',
  CANCELLED: 'bg-paper-dim text-slate',
};

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [revealCreds, setRevealCreds] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await superadminApi.listRestaurants({
        search: search || undefined,
        status: status || undefined,
      });
      setRestaurants(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load restaurants');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  function handleCreated(result) {
    load();
    if (result.ownerCredentials?.temporaryPassword) {
      setRevealCreds(result.ownerCredentials);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-ink mb-1">Restaurants</h1>
          <p className="text-sm text-slate">Manage every tenant on the platform.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
        >
          <Plus size={16} />
          New restaurant
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, email…"
            className="w-full border border-line rounded pl-8 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cobalt/40"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-line rounded px-3 py-2 text-sm bg-white"
        >
          <option value="">All statuses</option>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="ticket-edge bg-white border border-line rounded-ticket overflow-hidden mt-2">
        {loading ? (
          <p className="p-6 text-sm text-slate">Loading…</p>
        ) : restaurants.length === 0 ? (
          <p className="p-6 text-sm text-slate">No restaurants match your filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper-dim text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Tables</th>
                <th className="px-4 py-3 font-medium text-right">Orders</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-paper-dim/50">
                  <td className="px-4 py-3">
                    <Link to={`/superadmin/restaurants/${r.id}`} className="font-medium text-ink hover:underline">
                      {r.name}
                    </Link>
                    <p className="text-xs text-slate font-mono">{r.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-slate">{r.subscriptionPlan?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.counts?.tables ?? 0}</td>
                  <td className="px-4 py-3 text-right font-mono">{r.counts?.orders ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateRestaurantModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      {revealCreds && (
        <CredentialRevealModal
          open={!!revealCreds}
          onClose={() => setRevealCreds(null)}
          email={revealCreds.email}
          temporaryPassword={revealCreds.temporaryPassword}
        />
      )}
    </div>
  );
}
