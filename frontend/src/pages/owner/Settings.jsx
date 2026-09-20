import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, CreditCard, ShieldCheck, ShieldOff, DatabaseBackup, Download } from 'lucide-react';

import api from '@/api/client';
import { restaurantApi } from '@/api/restaurant';
import { downloadBlob } from '@/utils/reportExport';
import { useAuthStore } from '@/store/authStore';

export default function Settings() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === 'OWNER';

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password updated — please sign in again');
      localStorage.removeItem('qr-dining-refresh');
      setTimeout(() => (window.location.href = '/login'), 1200);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-md">
      <h1 className="font-display text-2xl text-ink mb-1">Settings</h1>
      <p className="text-sm text-slate mb-6">Manage your account security.</p>

      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={16} className="text-slate" />
          <p className="text-sm font-medium text-ink">Change password</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Current password</label>
            <input
              type="password"
              required
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="staff-menu-btn w-full rounded px-3 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      {isOwner && <PaymentGatewaySection />}
      {isOwner && <BackupSection />}
    </div>
  );
}

function PaymentGatewaySection() {
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/restaurant/payment-gateway')
      .then(({ data }) => {
        setStatus(data.data);
        setKeyId(data.data.razorpayKeyId || '');
      })
      .catch(() => toast.error('Failed to load payment gateway settings'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch('/restaurant/payment-gateway', {
        razorpayKeyId: keyId,
        ...(keySecret ? { razorpayKeySecret: keySecret } : {}),
      });
      setStatus((s) => ({ ...s, ...data.data }));
      setKeySecret('');
      toast.success('Payment gateway updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard size={16} className="text-slate" />
        <p className="text-sm font-medium text-ink">Online payment gateway (Razorpay)</p>
      </div>
      <p className="text-xs text-slate mb-4">
        Connect your own Razorpay account so online payments settle directly to you.
      </p>

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : (
        <>
          <div
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-ticket mb-4 ${
              status?.razorpayConfigured ? 'bg-basil-soft text-basil' : 'bg-paper-dim text-slate'
            }`}
          >
            {status?.razorpayConfigured ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
            {status?.razorpayConfigured ? 'Configured' : 'Not configured — customers will only see Pay Cash'}
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Key ID</label>
              <input
                type="text"
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                placeholder="rzp_live_xxxxxxxxxxxx"
                className="w-full border border-line rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">
                Key Secret {status?.razorpayKeySecretMasked && `(currently ${status.razorpayKeySecretMasked})`}
              </label>
              <input
                type="password"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                placeholder={status?.razorpayKeySecretMasked ? 'Leave blank to keep current secret' : 'Enter secret'}
                className="w-full border border-line rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="staff-menu-btn w-full rounded px-3 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

const BACKUP_FORMATS = [
  { value: 'EXCEL', label: 'Excel (.xlsx)' },
  { value: 'PDF', label: 'PDF' },
  { value: 'TXT', label: 'Text (.txt)' },
  { value: 'SQL', label: 'SQL' },
];

// Only rendered for the Owner, and only shows its actual content once
// SuperAdmin has switched Restaurant.backupEnabled on (see
// superadmin.controller.setPermissions / PermissionsCard.jsx) — an
// Owner without that permission never sees the button at all.
function BackupSection() {
  const [enabled, setEnabled] = useState(null); // null = still checking
  const [format, setFormat] = useState('EXCEL');
  const [creating, setCreating] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    restaurantApi
      .getPermissions()
      .then((data) => setEnabled(!!data.backupEnabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoadingHistory(false);
      return;
    }
    restaurantApi
      .listBackups()
      .then(setHistory)
      .catch(() => toast.error('Failed to load backup history'))
      .finally(() => setLoadingHistory(false));
  }, [enabled]);

  async function handleCreateBackup() {
    setCreating(true);
    try {
      const backup = await restaurantApi.createBackup(format);
      setHistory((h) => [backup, ...h]);
      toast.success('Backup created — a copy has also been archived with the platform admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  }

  async function handleDownload(backup) {
    try {
      const blob = await restaurantApi.downloadBackup(backup.id);
      downloadBlob(blob, backup.fileName);
    } catch (err) {
      toast.error('Failed to download backup');
    }
  }

  // Not enabled for this restaurant — SuperAdmin hasn't switched the
  // toggle on yet, so this section stays invisible rather than showing
  // a disabled/greyed-out state.
  if (enabled === false || enabled === null) return null;

  return (
    <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <DatabaseBackup size={16} className="text-slate" />
        <p className="text-sm font-medium text-ink">Data backup</p>
      </div>
      <p className="text-xs text-slate mb-4">
        Export your menu, tables, staff, orders, and payment history. A copy is automatically
        archived with the platform admin whenever you create one.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="border border-line rounded px-3 py-2 text-sm bg-white"
        >
          {BACKUP_FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="staff-menu-btn flex items-center gap-1.5 rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <DatabaseBackup size={14} /> {creating ? 'Generating…' : 'Backup now'}
        </button>
      </div>

      {!loadingHistory && history.length > 0 && (
        <div className="space-y-1.5 border-t border-line pt-3">
          <p className="text-[11px] font-semibold text-slate uppercase tracking-wide mb-1">Recent backups</p>
          {history.slice(0, 6).map((b) => (
            <div key={b.id} className="flex items-center justify-between text-xs">
              <span className="text-slate">
                {b.format} · {new Date(b.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              <button onClick={() => handleDownload(b)} className="flex items-center gap-1 text-cobalt hover:underline">
                <Download size={12} /> Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
