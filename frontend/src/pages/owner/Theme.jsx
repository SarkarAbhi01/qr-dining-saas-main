import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, ShoppingBag, RotateCcw, Lock } from 'lucide-react';

import { themeApi } from '@/api/theme';
import { useAuthStore } from '@/store/authStore';

const DEFAULTS = {
  bodyColor: '#faf9f6',
  headerColor: '#ffffff',
  menuColor: '#1c1b1a',
  hoverColor: '#2c2a28',
  fontFamily: 'Inter',
  fontSize: 16,
};

// Kept in sync with backend/src/validators/theme.validator.js ALLOWED_FONTS
const FONT_OPTIONS = ['Inter', 'Fraunces', 'Poppins', 'Roboto', 'Playfair Display', 'Nunito', 'Georgia', 'Arial'];

export default function Theme() {
  const [saved, setSaved] = useState({});
  const [draft, setDraft] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  // Backend enforces this too (theme.routes.js: PATCH is Owner-only) —
  // this is just so a Manager sees a clear "view only" state instead of
  // filling out the form and hitting a confusing 403 on Save.
  const canEdit = role === 'OWNER';

  useEffect(() => {
    themeApi
      .get()
      .then((cfg) => {
        setSaved(cfg);
        setDraft({ ...DEFAULTS, ...cfg });
      })
      .catch(() => toast.error('Failed to load theme'))
      .finally(() => setLoading(false));
  }, []);

  function update(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await themeApi.update(draft);
      setSaved(updated);
      setDraft({ ...DEFAULTS, ...updated });
      toast.success('Theme updated — customers will see it on their next scan');
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to save theme';
      toast.error(message, { duration: 6000 });
      // eslint-disable-next-line no-console
      console.error('Theme save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraft({ ...DEFAULTS });
  }

  if (loading) return <div className="p-6 text-sm text-slate">Loading theme…</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <h1 className="font-display text-2xl text-ink mb-1">Theme &amp; Branding</h1>
      <p className="text-sm text-slate mb-6">
        Customize the colors and font your customers see on the menu — updates live, no reprint needed.
      </p>

      {!canEdit && (
        <div className="flex items-start gap-2 bg-paper-dim border border-line rounded-ticket p-4 mb-6">
          <Lock className="text-slate shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-ink">
            You can see the restaurant's current theme here, but only the Owner can change it.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* --- Controls --- */}
        <fieldset
          disabled={!canEdit}
          className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2 space-y-5 disabled:opacity-60"
        >
          <ColorField
            label="Body color"
            hint="Overall page background on the customer menu"
            value={draft.bodyColor}
            onChange={(v) => update('bodyColor', v)}
          />
          <ColorField
            label="Header color"
            hint="Background of the sticky top bar"
            value={draft.headerColor}
            onChange={(v) => update('headerColor', v)}
          />
          <ColorField
            label="Menu color"
            hint="Buttons, active tabs, and accents"
            value={draft.menuColor}
            onChange={(v) => update('menuColor', v)}
          />
          <ColorField
            label="Hover color"
            hint="Button color on hover/press"
            value={draft.hoverColor}
            onChange={(v) => update('hoverColor', v)}
          />

          <div>
            <label className="block text-xs font-medium text-slate mb-1">Font</label>
            <select
              value={draft.fontFamily}
              onChange={(e) => update('fontFamily', e.target.value)}
              className="w-full border border-line rounded px-3 py-2 text-sm bg-white"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate mb-1">
              Base font size — {draft.fontSize}px
            </label>
            <input
              type="range"
              min="12"
              max="20"
              value={draft.fontSize}
              onChange={(e) => update('fontSize', Number(e.target.value))}
              className="w-full"
            />
          </div>

          {canEdit && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="staff-menu-btn flex-1 rounded px-3 py-2.5 text-sm font-medium disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save theme'}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 border border-line rounded px-3 py-2.5 text-sm font-medium text-slate hover:border-ink"
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          )}
        </fieldset>

        {/* --- Live preview --- */}
        <div>
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Live preview</p>
          <div className="border border-line rounded-ticket overflow-hidden shadow-sm">
            <div
              style={{
                backgroundColor: draft.bodyColor,
                fontFamily: `'${draft.fontFamily}', sans-serif`,
                fontSize: `${draft.fontSize}px`,
              }}
            >
              <div
                className="px-4 py-3 border-b border-line"
                style={{ backgroundColor: draft.headerColor }}
              >
                <p className="text-[10px] tracking-widest uppercase font-mono" style={{ color: draft.menuColor }}>
                  Your Restaurant
                </p>
                <p className="font-medium" style={{ color: '#1c1b1a' }}>
                  Table 4
                </p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <span
                    className="text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: draft.menuColor, color: draft.bodyColor }}
                  >
                    Starters
                  </span>
                  <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-line" style={{ color: '#1c1b1a' }}>
                    Mains
                  </span>
                </div>

                <div className="bg-white border border-line rounded p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#1c1b1a' }}>
                      Paneer Tikka
                    </p>
                    <p className="text-xs text-slate">₹249</p>
                  </div>
                  <button
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: draft.menuColor, color: draft.bodyColor }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = draft.hoverColor)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = draft.menuColor)}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>

                <button
                  className="w-full flex items-center justify-between px-4 py-3 rounded-ticket text-sm font-medium"
                  style={{ backgroundColor: draft.menuColor, color: draft.bodyColor }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = draft.hoverColor)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = draft.menuColor)}
                >
                  <span className="flex items-center gap-2">
                    <ShoppingBag size={16} /> 2 items
                  </span>
                  <span>View cart · ₹498</span>
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate mt-2">
            Hover the "Add" or "View cart" buttons above to preview the hover color.
          </p>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, hint, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded border border-line cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border border-line rounded px-3 py-2 text-sm font-mono"
        />
      </div>
      {hint && <p className="text-[11px] text-slate mt-1">{hint}</p>}
    </div>
  );
}
