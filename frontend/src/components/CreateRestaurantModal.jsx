import { useState } from 'react';
import toast from 'react-hot-toast';

import Modal from '@/components/Modal';
import { superadminApi } from '@/api/superadmin';

const emptyForm = {
  name: '',
  slug: '',
  address: '',
  phone: '',
  email: '',
  ownerName: '',
  ownerEmail: '',
};

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function CreateRestaurantModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Auto-derive slug from name unless the user has edited it manually
      if (field === 'name' && !f._slugTouched) next.slug = slugify(value);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await superadminApi.createRestaurant({
        name: form.name,
        slug: form.slug,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        owner: { name: form.ownerName, email: form.ownerEmail },
      });
      toast.success(`${result.restaurant.name} created`);
      setForm(emptyForm);
      onCreated(result);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create restaurant');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Restaurant" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">
            Restaurant details
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required value={form.name} onChange={(v) => update('name', v)} span={2} />
            <Field
              label="URL slug"
              required
              value={form.slug}
              onChange={(v) => update('slug', v)}
              hint="Used in QR menu links"
              span={2}
            />
            <Field label="Phone" value={form.phone} onChange={(v) => update('phone', v)} />
            <Field label="Contact email" value={form.email} onChange={(v) => update('email', v)} />
            <Field label="Address" value={form.address} onChange={(v) => update('address', v)} span={2} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">
            Owner account
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Owner name"
              required
              value={form.ownerName}
              onChange={(v) => update('ownerName', v)}
              span={2}
            />
            <Field
              label="Owner email"
              type="email"
              required
              value={form.ownerEmail}
              onChange={(v) => update('ownerEmail', v)}
              span={2}
            />
          </div>
          <p className="text-xs text-slate mt-2">
            A temporary password is auto-generated and shown once after creation.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink text-paper rounded px-3 py-2.5 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create restaurant'}
        </button>
      </form>
    </Modal>
  );
}

function Field({ label, value, onChange, required, type = 'text', hint, span = 1 }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-slate mb-1">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-line rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cobalt/40"
      />
      {hint && <p className="text-[11px] text-slate mt-1">{hint}</p>}
    </div>
  );
}
