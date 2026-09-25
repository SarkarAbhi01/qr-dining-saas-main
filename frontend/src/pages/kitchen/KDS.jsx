import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Flame, LogOut, Volume2, VolumeX, Printer, PrinterCheck, ArrowLeft } from 'lucide-react';

import { kdsApi } from '@/api/kds';
import api from '@/api/client';
import { useSocket } from '@/sockets/useSocket';
import { disconnectSocket } from '@/sockets/socketClient';
import { useAuthStore } from '@/store/authStore';
import { playNotificationSound, isSoundEnabled, setSoundEnabled } from '@/utils/sound';
import { useRestaurantTheme } from '@/hooks/useRestaurantTheme';
import { printReceipt, buildKotHtml } from '@/utils/print';
import SearchSortFilterBar from '@/components/SearchSortFilterBar';

const AUTO_PRINT_KEY = 'qr-dining-kds-autoprint';
const isAutoPrintEnabled = () => localStorage.getItem(AUTO_PRINT_KEY) !== 'off';
const setAutoPrintEnabled = (on) => localStorage.setItem(AUTO_PRINT_KEY, on ? 'on' : 'off');

const ACTIVE_STATUSES = ['PENDING', 'PREPARING', 'READY'];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
];
const SOURCE_FILTER_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'WAITER_MANUAL', label: 'Manual entry' },
  { value: 'CUSTOMER_QR', label: 'QR order' },
];
const SORT_OPTIONS = [
  { value: 'oldest', label: 'Oldest first' },
  { value: 'newest', label: 'Newest first' },
];

// Next status a single tap advances an order to.
const NEXT_STATUS = { PENDING: 'PREPARING', PREPARING: 'READY' };
const BUTTON_LABEL = { PENDING: 'Start preparing', PREPARING: 'Mark ready' };

function elapsedMinutes(placedAt) {
  return Math.floor((Date.now() - new Date(placedAt).getTime()) / 60000);
}

// Green -> Yellow -> Red as the ticket ages, per the brief.
function urgencyTier(minutes) {
  if (minutes >= 12) return 'delayed';
  if (minutes >= 6) return 'preparing';
  return 'received';
}

const TIER_STYLES = {
  received: { rail: 'bg-status-received', badge: 'bg-paper-dim text-ink' },
  preparing: { rail: 'bg-saffron', badge: 'bg-saffron/15 text-saffron-dark' },
  delayed: { rail: 'bg-chili', badge: 'bg-chili-soft text-chili' },
};

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, forceTick] = useState(0);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [autoPrintOn, setAutoPrintOn] = useState(isAutoPrintEnabled());
  const autoPrintRef = useRef(autoPrintOn);
  useEffect(() => {
    autoPrintRef.current = autoPrintOn;
  }, [autoPrintOn]);
  const [stats, setStats] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortDir, setSortDir] = useState('oldest');
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const isStaffVisiting = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const { style: themeStyle } = useRestaurantTheme();

  const loadStats = useCallback(() => {
    kdsApi.todayStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    // Silently ignored if the Owner hasn't granted report access —
    // there's simply nothing to show, not an error state.
    kdsApi.myPerformance().then(setMyStats).catch(() => {});
  }, []);

  useEffect(() => {
    kdsApi
      .listActiveOrders()
      .then(setOrders)
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
    loadStats();
  }, [loadStats]);

  // Re-render every 15s purely to recompute elapsed-time colors.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const upsertOrder = useCallback((incoming) => {
    setOrders((prev) => {
      const withoutIt = prev.filter((o) => o.id !== incoming.id);
      if (!ACTIVE_STATUSES.includes(incoming.status)) return withoutIt; // bumped off the board
      return [...withoutIt, incoming].sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt));
    });
  }, []);

  useSocket({
    'order:new': (order) => {
      upsertOrder(order);
      playNotificationSound('newOrder');
      toast(`New order — Table ${order.table?.tableNumber ?? ''}`, { icon: '🔔' });
      loadStats();
      if (autoPrintRef.current) {
        printReceipt(buildKotHtml(order));
      }
    },
    'order:update': (order) => {
      upsertOrder(order);
      loadStats();
    },
  });

  async function handleAccept(order) {
    try {
      const updated = await kdsApi.acceptOrder(order.id);
      upsertOrder(updated);
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept order');
    }
  }

  async function handleAdvance(order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      const updated = await kdsApi.updateOrderStatus(order.id, next);
      upsertOrder(updated);
      loadStats();
    } catch {
      toast.error('Failed to update order');
    }
  }

  async function handleLogout() {
    const refreshToken = localStorage.getItem('qr-dining-refresh');
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      /* best effort */
    }
    localStorage.removeItem('qr-dining-refresh');
    logout();
    disconnectSocket();
  }

  const sorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...orders]
      .filter((o) => (query ? String(o.table?.tableNumber ?? '').toLowerCase().includes(query) : true))
      .filter((o) => (statusFilter ? o.status === statusFilter : true))
      .filter((o) => (sourceFilter ? o.source === sourceFilter : true))
      .sort((a, b) =>
        sortDir === 'newest'
          ? new Date(b.placedAt) - new Date(a.placedAt)
          : new Date(a.placedAt) - new Date(b.placedAt)
      );
  }, [orders, search, statusFilter, sourceFilter, sortDir]);

  return (
    <div
      className="min-h-screen bg-ink text-paper"
      style={{
        // Font follows the Owner's theme like every other dashboard.
        // Background intentionally stays the fixed dark "ink" theme
        // regardless of what color the Owner sets — this is a
        // distraction-free, high-contrast display meant to be read at
        // a glance in a working kitchen, and a Owner-picked light or
        // dark "body color" here could easily wreck that contrast.
        fontFamily: themeStyle['--staff-font'],
        fontSize: themeStyle['--staff-font-size'],
      }}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          {isStaffVisiting && (
            <Link
              to="/owner"
              className="flex items-center gap-1 text-paper/60 hover:text-paper text-xs font-medium mr-2 border border-white/10 rounded px-2 py-1"
              title="Back to your dashboard — you'll stay signed in"
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
          )}
          <Flame size={20} className="text-saffron" />
          <h1 className="font-display text-xl">Kitchen Display</h1>
          {myStats && (
            <span className="ml-3 text-[11px] font-mono text-paper/50 bg-white/5 px-2 py-1 rounded-full">
              You today: {myStats.ordersAccepted} accepted · {myStats.ordersCompleted} completed
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Whoever is actually logged in — accept/serve actions in this
              session record against THIS identity, never a staff
              member's, so this is always the ground truth for "who is
              doing this." */}
          <span className="text-[11px] text-paper/50">
            Signed in as <span className="text-paper/80 font-medium">{user?.name}</span>
            {isStaffVisiting ? ` (${user.role === 'OWNER' ? 'Owner' : 'Manager'})` : ''}
          </span>
          <span className="text-xs font-mono text-paper/60">
            {sorted.length}{sorted.length !== orders.length ? ` of ${orders.length}` : ''} active
          </span>
          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
            }}
            className="text-paper/60 hover:text-paper"
            title={soundOn ? 'Mute alerts' : 'Unmute alerts'}
          >
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={() => {
              const next = !autoPrintOn;
              setAutoPrintOn(next);
              setAutoPrintEnabled(next);
              toast.success(next ? 'Auto-print KOT enabled' : 'Auto-print KOT disabled');
            }}
            className={autoPrintOn ? 'text-paper/60 hover:text-paper' : 'text-paper/30 hover:text-paper/60'}
            title={autoPrintOn ? 'Disable auto-print KOT' : 'Enable auto-print KOT'}
          >
            {autoPrintOn ? <PrinterCheck size={18} /> : <Printer size={18} />}
          </button>
          <button onClick={handleLogout} className="text-paper/60 hover:text-paper">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="p-4">
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <StatChip label="Today's Orders" value={stats.todaysOrders} />
            <StatChip label="Accepted" value={stats.accepted} />
            <StatChip label="Pending" value={stats.pending} accent="text-saffron" />
            <StatChip label="Completed" value={stats.completed} accent="text-basil" />
          </div>
        )}

        <SearchSortFilterBar
          dark
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by table number…"
          sortOptions={SORT_OPTIONS}
          sortValue={sortDir}
          onSortChange={setSortDir}
          filters={[
            { key: 'status', label: 'Status', value: statusFilter, onChange: setStatusFilter, options: STATUS_FILTER_OPTIONS },
            { key: 'source', label: 'Source', value: sourceFilter, onChange: setSourceFilter, options: SOURCE_FILTER_OPTIONS },
          ]}
          className="mb-4"
        />

        {loading ? (
          <p className="text-paper/60 text-sm px-2">Loading orders…</p>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-paper/40">
            <Flame size={40} className="mb-3" />
            <p className="text-lg font-display">All caught up</p>
            <p className="text-sm">
              {orders.length === 0 ? 'No active orders in the queue.' : 'No orders match your search/filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map((order) => (
              <OrderTicket
                key={order.id}
                order={order}
                onAdvance={() => handleAdvance(order)}
                onAccept={() => handleAccept(order)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatChip({ label, value, accent = 'text-paper' }) {
  return (
    <div className="bg-ink-soft border border-white/10 rounded-ticket px-3 py-2.5 text-center">
      <p className={`font-display text-xl ${accent}`}>{value}</p>
      <p className="text-[10px] text-paper/50 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function OrderTicket({ order, onAdvance, onAccept }) {
  const minutes = elapsedMinutes(order.placedAt);
  const tier = urgencyTier(minutes);
  const styles = TIER_STYLES[tier];
  const liveItems = order.items?.filter((i) => i.status !== 'CANCELLED') || [];

  return (
    <div className="ticket-edge bg-ink-soft rounded-ticket overflow-hidden mt-2 flex flex-col border border-white/10">
      <div className={`h-1.5 ${styles.rail}`} />
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-display text-2xl leading-none">T{order.table?.tableNumber ?? '—'}</p>
            <p className="text-[11px] text-paper/50 font-mono mt-1">
              {order.source === 'WAITER_MANUAL' ? 'Manual entry' : 'QR order'}
            </p>
            {order.orderType === 'PARCEL' && (
              <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide bg-saffron text-ink px-1.5 py-0.5 rounded">
                Parcel
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => printReceipt(buildKotHtml(order))}
              className="text-paper/50 hover:text-paper p-1"
              title="Reprint KOT"
            >
              <Printer size={14} />
            </button>
            <span className={`text-xs font-mono font-semibold px-2 py-1 rounded-full ${styles.badge}`}>
              {minutes}m
            </span>
          </div>
        </div>

        <ul className="space-y-2.5 flex-1">
          {liveItems.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  {item.quantity}× {item.menuItem?.name}
                  {item.portion === 'HALF' && (
                    <span className="ml-1.5 text-[10px] font-semibold text-saffron align-middle">HALF</span>
                  )}
                </span>
              </div>
              {item.modifiers?.length > 0 && (
                <p className="text-xs text-paper/50">
                  {item.modifiers.map((m) => m.modifierOption?.name).join(', ')}
                </p>
              )}
              {item.notes && <p className="text-xs text-saffron">"{item.notes}"</p>}
            </li>
          ))}
        </ul>

        {order.acceptedBy ? (
          <p className="text-[11px] text-paper/50 mt-2 mb-1">
            Accepted by <span className="text-paper">{order.acceptedBy.name}</span>
          </p>
        ) : (
          <button
            onClick={onAccept}
            className="mt-3 w-full border border-saffron text-saffron rounded py-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            Accept order
          </button>
        )}

        {BUTTON_LABEL[order.status] ? (
          <button
            onClick={onAdvance}
            className="mt-2 w-full bg-paper text-ink rounded py-3 text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            {BUTTON_LABEL[order.status]}
          </button>
        ) : (
          <div className="mt-2 w-full bg-basil/15 text-basil rounded py-3 text-sm font-semibold text-center">
            Ready — waiting for waiter
          </div>
        )}
      </div>
    </div>
  );
}
