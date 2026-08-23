import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';

export default function PlanAssignmentCard({ restaurant, onUpdated }) {
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(restaurant.subscriptionPlan?.id || '');
  const [durationDays, setDurationDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    superadminApi.listPlans().then(setPlans).catch(() => {});
  }, []);

  async function handleAssign(e) {
    e.preventDefault();
    if (!planId) return;
    setSubmitting(true);
    try {
      const updated = await superadminApi.assignPlan(restaurant.id, {
        subscriptionPlanId: planId,
        durationDays: Number(durationDays),
      });
      onUpdated((r) => ({ ...r, ...updated }));
      toast.success(`Plan assigned for ${durationDays} days`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign plan');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
      <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Subscription Plan</p>
      <p className="text-sm text-ink mb-1">
        Current: <span className="font-medium">{restaurant.subscriptionPlan?.name || 'None'}</span>
      </p>
      {restaurant.subscriptionEndsAt && (
        <p className="text-xs text-slate mb-3">
          Valid until {new Date(restaurant.subscriptionEndsAt).toLocaleDateString()}
        </p>
      )}
      <form onSubmit={handleAssign} className="flex gap-2 items-end mt-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate mb-1">Assign plan</label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full border border-line rounded px-2.5 py-2 text-sm bg-white"
          >
            <option value="">Select…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — ₹{Number(p.priceMonthly).toLocaleString()}/mo
              </option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-slate mb-1">Days</label>
          <input
            type="number"
            min="1"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            className="w-full border border-line rounded px-2.5 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !planId}
          className="bg-ink text-paper rounded px-3 py-2 text-sm font-medium disabled:opacity-40 shrink-0"
        >
          Assign
        </button>
      </form>
    </div>
  );
}
