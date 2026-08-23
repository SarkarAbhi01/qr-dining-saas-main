import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';
import Modal from '@/components/Modal';

const emptyForm = { name: '', description: '', priceMonthly: '', maxTables: 10, maxStaff: 10 };

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      setPlans(await superadminApi.listPlans());
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await superadminApi.createPlan({
        ...form,
        priceMonthly: Number(form.priceMonthly),
        maxTables: Number(form.maxTables),
        maxStaff: Number(form.maxStaff),
      });
      toast.success('Plan created');
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create plan');
    }
  }

  async function toggleActive(plan) {
    try {
      await superadminApi.updatePlan(plan.id, { isActive: !plan.isActive });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update plan');
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-ink mb-1">Subscription Plans</h1>
          <p className="text-sm text-slate">Define pricing tiers restaurants subscribe to.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-ink text-paper rounded px-4 py-2 text-sm font-medium hover:bg-ink-soft transition-colors"
        >
          <Plus size={16} /> New plan
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-lg text-ink">{p.name}</h3>
                {!p.isActive && (
                  <span className="text-[10px] font-medium bg-paper-dim text-slate px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-sm text-slate mb-3 flex-1">{p.description}</p>
              <p className="font-mono text-2xl text-ink mb-3">
                ₹{Number(p.priceMonthly).toLocaleString()}
                <span className="text-xs text-slate font-sans">/mo</span>
              </p>
              <p className="text-xs text-slate mb-4">
                Up to {p.maxTables} tables · {p.maxStaff} staff
              </p>
              <button
                onClick={() => toggleActive(p)}
                className="text-xs font-medium border border-line rounded px-3 py-1.5 hover:border-ink transition-colors"
              >
                {p.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New subscription plan">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Plan name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Price/mo (₹)</label>
              <input
                type="number"
                required
                min="1"
                value={form.priceMonthly}
                onChange={(e) => setForm((f) => ({ ...f, priceMonthly: e.target.value }))}
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Max tables</label>
              <input
                type="number"
                min="1"
                value={form.maxTables}
                onChange={(e) => setForm((f) => ({ ...f, maxTables: e.target.value }))}
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Max staff</label>
              <input
                type="number"
                min="1"
                value={form.maxStaff}
                onChange={(e) => setForm((f) => ({ ...f, maxStaff: e.target.value }))}
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-ink text-paper rounded px-3 py-2.5 text-sm font-medium">
            Create plan
          </button>
        </form>
      </Modal>
    </div>
  );
}
