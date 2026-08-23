import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';
import Modal from '@/components/Modal';
import CredentialRevealModal from '@/components/CredentialRevealModal';
import PlanAssignmentCard from '@/components/superadmin/PlanAssignmentCard';
import RevenueModelCard from '@/components/superadmin/RevenueModelCard';
import CustomLimitsCard from '@/components/superadmin/CustomLimitsCard';

const STATUS_OPTIONS = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'];
const REASON_REQUIRED = ['SUSPENDED', 'CANCELLED'];

export default function RestaurantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [credForm, setCredForm] = useState({ name: '', email: '', role: 'MANAGER' });
  const [revealCreds, setRevealCreds] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [statusModal, setStatusModal] = useState(null); // status pending a reason
  const [statusReason, setStatusReason] = useState('');

  async function load() {
    setLoading(true);
    try {
      setRestaurant(await superadminApi.getRestaurant(id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load restaurant');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleStatusClick(status) {
    if (REASON_REQUIRED.includes(status)) {
      setStatusModal(status);
      setStatusReason('');
    } else {
      applyStatusChange(status, null);
    }
  }

  async function applyStatusChange(status, reason) {
    try {
      const updated = await superadminApi.changeStatus(id, { status, reason: reason || undefined });
      setRestaurant((r) => ({ ...r, status: updated.status, statusReason: updated.statusReason }));
      toast.success(`Status set to ${status}`);
      setStatusModal(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  }

  async function handleCreateCredential(e) {
    e.preventDefault();
    try {
      const result = await superadminApi.createCredential(id, credForm);
      setCredModalOpen(false);
      setCredForm({ name: '', email: '', role: 'MANAGER' });
      load();
      if (result.credentials?.temporaryPassword) setRevealCreds(result.credentials);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create credentials');
    }
  }

  async function handleResetPassword(userId) {
    try {
      const result = await superadminApi.resetPassword(userId);
      setRevealCreds({ email: result.email, temporaryPassword: result.temporaryPassword });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
  }

  async function handleDelete() {
    if (!deleteReason.trim()) {
      toast.error('A reason is required to delete a restaurant');
      return;
    }
    try {
      await superadminApi.deleteRestaurant(id, deleteReason.trim());
      toast.success('Restaurant deleted');
      navigate('/superadmin/restaurants');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete restaurant');
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate">Loading…</div>;
  if (!restaurant) return null;

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <Link to="/superadmin/restaurants" className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink mb-4">
        <ArrowLeft size={14} /> All restaurants
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-ink">{restaurant.name}</h1>
          <p className="text-sm text-slate font-mono">{restaurant.slug}</p>
        </div>
        <button
          onClick={() => setDeleteOpen(true)}
          className="flex items-center gap-1.5 text-chili text-sm border border-chili/30 rounded px-3 py-1.5 hover:bg-chili-soft transition-colors"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-4">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Status</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusClick(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                restaurant.status === s
                  ? 'bg-ink text-paper border-ink'
                  : 'border-line text-slate hover:border-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {restaurant.statusReason && (
          <p className="text-xs text-slate mt-2">
            <span className="font-medium">Reason on file:</span> {restaurant.statusReason}
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <PlanAssignmentCard restaurant={restaurant} onUpdated={setRestaurant} />
        <RevenueModelCard restaurant={restaurant} onUpdated={setRestaurant} />
      </div>

      <div className="mb-4">
        <CustomLimitsCard restaurant={restaurant} onUpdated={setRestaurant} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <MiniStat label="Tables" value={restaurant.counts?.tables ?? 0} />
        <MiniStat label="Staff" value={restaurant.counts?.users ?? 0} />
        <MiniStat label="Orders" value={restaurant.counts?.orders ?? 0} />
      </div>

      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate uppercase tracking-wide">Owners &amp; Managers</p>
          <button
            onClick={() => setCredModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-cobalt hover:underline"
          >
            <KeyRound size={13} /> Add credentials
          </button>
        </div>
        <div className="space-y-2">
          {restaurant.managers?.map((m) => (
            <div key={m.id} className="flex items-center justify-between border-t border-line pt-2 first:border-t-0 first:pt-0">
              <div>
                <p className="text-sm text-ink">{m.name}</p>
                <p className="text-xs text-slate">{m.email} · {m.role}</p>
              </div>
              <button
                onClick={() => handleResetPassword(m.id)}
                className="text-xs text-cobalt hover:underline"
              >
                Reset password
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* --- Add credential modal --- */}
      <Modal open={credModalOpen} onClose={() => setCredModalOpen(false)} title="Add Owner / Manager">
        <form onSubmit={handleCreateCredential} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Name</label>
            <input
              required
              value={credForm.name}
              onChange={(e) => setCredForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Email</label>
            <input
              type="email"
              required
              value={credForm.email}
              onChange={(e) => setCredForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Role</label>
            <select
              value={credForm.role}
              onChange={(e) => setCredForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm bg-white"
            >
              <option value="OWNER">Owner</option>
              <option value="MANAGER">Manager</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-ink text-paper rounded px-3 py-2.5 text-sm font-medium">
            Create account
          </button>
        </form>
      </Modal>

      {/* --- Status reason (SUSPENDED / CANCELLED) --- */}
      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title={`Set status to ${statusModal}`}>
        <p className="text-sm text-slate mb-3">
          A reason is required whenever a restaurant is suspended or cancelled, for accountability.
        </p>
        <textarea
          required
          value={statusReason}
          onChange={(e) => setStatusReason(e.target.value)}
          placeholder="e.g. Stopped paying commission for 30 days"
          rows={3}
          className="w-full border border-line rounded px-3 py-2 text-sm mb-3"
        />
        <button
          onClick={() => applyStatusChange(statusModal, statusReason)}
          disabled={!statusReason.trim()}
          className="w-full bg-chili text-white rounded px-3 py-2.5 text-sm font-medium disabled:opacity-40"
        >
          Confirm {statusModal}
        </button>
      </Modal>

      {/* --- Delete confirm --- */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete restaurant?">
        <p className="text-sm text-slate mb-4">
          This permanently deletes <strong className="text-ink">{restaurant.name}</strong> and all
          of its tables, menu, orders, and staff accounts. This can't be undone.
        </p>
        <label className="block text-xs font-medium text-slate mb-1">Reason (required, kept on record)</label>
        <textarea
          required
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
          placeholder="e.g. Restaurant closed permanently"
          rows={2}
          className="w-full border border-line rounded px-3 py-2 text-sm mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setDeleteOpen(false)}
            className="flex-1 border border-line rounded px-3 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!deleteReason.trim()}
            className="flex-1 bg-chili text-white rounded px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
          >
            Delete permanently
          </button>
        </div>
      </Modal>

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

function MiniStat({ label, value }) {
  return (
    <div className="ticket-edge bg-white border border-line rounded-ticket p-4 mt-2 text-center">
      <p className="font-display text-2xl text-ink">{value}</p>
      <p className="text-xs text-slate uppercase tracking-wide">{label}</p>
    </div>
  );
}
