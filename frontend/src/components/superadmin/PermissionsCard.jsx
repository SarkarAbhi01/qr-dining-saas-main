import { useState } from 'react';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';

function Toggle({ label, description, enabled, onToggle, disabled }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-t border-line first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        <p className="text-xs text-slate">{description}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 disabled:opacity-40 ${
          enabled ? 'bg-basil' : 'bg-paper-dim'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

// Two independent per-tenant switches an Owner otherwise has no way to
// turn on themselves — mirrors CustomLimitsCard's pattern (optimistic
// local state, PATCH on toggle, roll the parent's restaurant state
// forward from the response).
export default function PermissionsCard({ restaurant, onUpdated }) {
  const [saving, setSaving] = useState(null); // which field is mid-save, or null

  async function handleToggle(field, currentValue) {
    setSaving(field);
    try {
      const updated = await superadminApi.setPermissions(restaurant.id, { [field]: !currentValue });
      onUpdated((r) => ({ ...r, ...updated }));
      toast.success(
        field === 'excelExportEnabled'
          ? `Excel/CSV export ${!currentValue ? 'enabled' : 'disabled'} for this restaurant`
          : `Data backup ${!currentValue ? 'enabled' : 'disabled'} for this restaurant`
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update permission');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
      <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-1">Feature Permissions</p>
      <Toggle
        label="Excel / CSV export"
        description="Shows the Excel(CSV)/print download buttons on this restaurant's Reports screen."
        enabled={restaurant.excelExportEnabled !== false}
        disabled={saving === 'excelExportEnabled'}
        onToggle={() => handleToggle('excelExportEnabled', restaurant.excelExportEnabled !== false)}
      />
      <Toggle
        label="Data backup"
        description="Lets the Owner export their data (Excel/PDF/TXT/SQL) from Settings. A .bak archive copy always lands in your Backups list."
        enabled={!!restaurant.backupEnabled}
        disabled={saving === 'backupEnabled'}
        onToggle={() => handleToggle('backupEnabled', !!restaurant.backupEnabled)}
      />
    </div>
  );
}
