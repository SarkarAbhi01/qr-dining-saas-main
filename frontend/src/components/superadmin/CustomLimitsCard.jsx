import { useState } from 'react';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';

export default function CustomLimitsCard({ restaurant, onUpdated }) {
  const [enabled, setEnabled] = useState(restaurant.customLimitsEnabled || false);
  const [maxTables, setMaxTables] = useState(restaurant.customMaxTables || 20);
  const [maxStaff, setMaxStaff] = useState(restaurant.customMaxStaff || 20);
  const [validityDays, setValidityDays] = useState(30);
  const [saving, setSaving] = useState(false);

  async function handleSave(nextEnabled) {
    setSaving(true);
    try {
      const updated = await superadminApi.setCustomLimits(restaurant.id, {
        customLimitsEnabled: nextEnabled,
        customMaxTables: nextEnabled ? Number(maxTables) : undefined,
        customMaxStaff: nextEnabled ? Number(maxStaff) : undefined,
        validityDays: nextEnabled ? Number(validityDays) : undefined,
      });
      onUpdated((r) => ({ ...r, ...updated }));
      setEnabled(nextEnabled);
      toast.success(nextEnabled ? 'Custom limits enabled — plan limits bypassed' : 'Custom limits disabled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update limits');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate uppercase tracking-wide">Plan Limit Bypass</p>
        <button
          onClick={() => handleSave(!enabled)}
          disabled={saving}
          className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${enabled ? 'bg-basil' : 'bg-paper-dim'}`}
        >
          <span
            className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-slate mb-3">
        When on, table/staff limits use these custom values (with a validity window) instead of the
        assigned plan's limits.
      </p>

      {restaurant.customLimitsExpiresAt && restaurant.customLimitsEnabled && (
        <p className="text-xs text-saffron-dark mb-3">
          Active until {new Date(restaurant.customLimitsExpiresAt).toLocaleDateString()}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate mb-1">Max tables</label>
          <input
            type="number"
            min="1"
            value={maxTables}
            onChange={(e) => setMaxTables(e.target.value)}
            className="w-full border border-line rounded px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate mb-1">Max staff</label>
          <input
            type="number"
            min="1"
            value={maxStaff}
            onChange={(e) => setMaxStaff(e.target.value)}
            className="w-full border border-line rounded px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate mb-1">Valid for (days)</label>
          <input
            type="number"
            min="1"
            value={validityDays}
            onChange={(e) => setValidityDays(e.target.value)}
            className="w-full border border-line rounded px-2.5 py-2 text-sm"
          />
        </div>
      </div>
      <button
        onClick={() => handleSave(true)}
        disabled={saving}
        className="mt-3 bg-ink text-paper rounded px-3 py-2 text-sm font-medium disabled:opacity-40"
      >
        Apply &amp; Enable
      </button>
    </div>
  );
}
