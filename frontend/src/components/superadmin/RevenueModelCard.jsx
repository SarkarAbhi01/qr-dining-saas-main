import { useState } from 'react';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';

export default function RevenueModelCard({ restaurant, onUpdated }) {
  const [model, setModel] = useState(restaurant.revenueModel || 'MONTHLY_FEE');
  const [rate, setRate] = useState(restaurant.commissionRatePercent || 5);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await superadminApi.setRevenueModel(restaurant.id, {
        revenueModel: model,
        commissionRatePercent: model === 'COMMISSION' ? Number(rate) : undefined,
      });
      onUpdated((r) => ({ ...r, ...updated }));
      toast.success('Revenue model updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update revenue model');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
      <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-3">Revenue Model</p>
      <p className="text-xs text-slate mb-3">Choose exactly one — never both at once.</p>

      <div className="space-y-2 mb-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            checked={model === 'MONTHLY_FEE'}
            onChange={() => setModel('MONTHLY_FEE')}
          />
          Fixed monthly plan fee
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            checked={model === 'COMMISSION'}
            onChange={() => setModel('COMMISSION')}
          />
          Commission per table-booking order
        </label>
      </div>

      {model === 'COMMISSION' && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate mb-1">Commission rate (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-28 border border-line rounded px-2.5 py-2 text-sm"
          />
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-ink text-paper rounded px-3 py-2 text-sm font-medium disabled:opacity-40"
      >
        Save
      </button>
    </div>
  );
}
