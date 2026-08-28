import { useEffect, useState } from 'react';
import { Plus, KeyRound, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

import { restaurantApi } from '@/api/restaurant';
import Modal from '@/components/Modal';
import CredentialRevealModal from '@/components/CredentialRevealModal';

const ROLE_STYLES = {
  MANAGER: 'bg-cobalt-soft text-cobalt',
  CHEF: 'bg-saffron/20 text-saffron-dark',
  WAITER: 'bg-basil-soft text-basil',
};

const emptyForm = { name: '', email: '', phone: '', role: 'WAITER' };

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // staff member being edited, null = "create new"
  const [form, setForm] = useState(emptyForm);
  const [revealCreds, setRevealCreds] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setStaff(await restaurantApi.listStaff());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(member) {
    setEditTarget(member);
    setForm({ name: member.name, email: member.email, phone: member.phone || '', role: member.role });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editTarget) {
        await restaurantApi.updateStaff(editTarget.id, {
          name: form.name,
          phone: form.phone || null,
          role: form.role,
        });
        toast.success('Staff details updated');
      } else {
        const result = await restaurantApi.createStaff(form);
        toast.success(`${form.name} added as ${form.role.toLowerCase()}`);
        if (result.credentials?.temporaryPassword) setRevealCreds(result.credentials);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save staff member');
    }
  }

  async function handleToggleActive(member) {
    try {
      await restaurantApi.updateStaff(member.id, { isActive: !member.isActive });
      load();
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  async function handleToggleReports(member) {
    try {
      await restaurantApi.updateStaff(member.id, { canViewOwnReports: !member.canViewOwnReports });
      load();
    } catch (err) {
      toast.error('Failed to update permission');
    }
  }

  async function handleConfirmReset() {
    if (!resetTarget) return;
    try {
      const result = await restaurantApi.resetStaffPassword(resetTarget.id);
      setResetTarget(null);
      setRevealCreds(result);
    } catch (err) {
      toast.error('Failed to reset password');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this staff member?')) return;
    try {
      await restaurantApi.deleteStaff(id);
      toast.success('Staff member removed');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove staff member');
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-ink mb-1">Staff</h1>
          <p className="text-sm text-slate">Manage Chef, Waiter, and Manager accounts.</p>
        </div>
        <button
          onClick={openCreate}
          className="staff-menu-btn flex items-center gap-1.5 rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Add staff
        </button>
      </div>

      <div className="ticket-edge bg-white border border-line rounded-ticket overflow-hidden mt-2">
        {loading ? (
          <p className="p-6 text-sm text-slate">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="p-6 text-sm text-slate">No staff added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper-dim text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reports</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <p className="text-ink font-medium">{m.name}</p>
                    <p className="text-xs text-slate">{m.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_STYLES[m.role]}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(m)}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        m.isActive ? 'bg-basil-soft text-basil' : 'bg-paper-dim text-slate'
                      }`}
                    >
                      {m.isActive ? 'Active' : 'Deactivated'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {m.role === 'MANAGER' ? (
                      <span className="text-xs text-slate">—</span>
                    ) : (
                      <button
                        onClick={() => handleToggleReports(m)}
                        title="Let this staff member view their own performance report"
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          m.canViewOwnReports ? 'bg-cobalt-soft text-cobalt' : 'bg-paper-dim text-slate'
                        }`}
                      >
                        {m.canViewOwnReports ? 'Granted' : 'Off'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEdit(m)} className="text-slate hover:text-ink" title="Edit details">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setResetTarget(m)} className="text-cobalt hover:opacity-70" title="Reset password">
                        <KeyRound size={14} />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="text-chili hover:opacity-70" title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit staff member' : 'Add staff member'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Email</label>
            <input
              type="email"
              required
              disabled={!!editTarget}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm disabled:bg-paper-dim disabled:text-slate"
            />
            {editTarget && <p className="text-[11px] text-slate mt-1">Email can't be changed after creation.</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Phone (optional)</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm bg-white"
            >
              <option value="WAITER">Waiter</option>
              <option value="CHEF">Chef</option>
              <option value="MANAGER">Manager</option>
            </select>
          </div>
          <button type="submit" className="staff-menu-btn w-full rounded px-3 py-2.5 text-sm font-medium">
            {editTarget ? 'Save changes' : 'Create account'}
          </button>
        </form>
      </Modal>

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset password?">
        <p className="text-sm text-slate mb-4">
          This immediately invalidates <strong className="text-ink">{resetTarget?.name}</strong>'s current
          password and generates a new temporary one. They'll need it to sign in again.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setResetTarget(null)}
            className="flex-1 border border-line rounded px-3 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmReset}
            className="flex-1 bg-chili text-white rounded px-3 py-2 text-sm font-medium hover:opacity-90"
          >
            Reset password
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
