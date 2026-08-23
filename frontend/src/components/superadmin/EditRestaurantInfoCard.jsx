import { useState } from 'react';
import { Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

import { superadminApi } from '@/api/superadmin';
import Modal from '@/components/Modal';

export default function EditRestaurantInfoCard({ restaurant, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: restaurant.name,
    email: restaurant.email || '',
    phone: restaurant.phone || '',
    address: restaurant.address || '',
  });
  const [saving, setSaving] = useState(false);

  function openModal() {
    setForm({
      name: restaurant.name,
      email: restaurant.email || '',
      phone: restaurant.phone || '',
      address: restaurant.address || '',
    });
    setOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await superadminApi.updateRestaurant(restaurant.id, {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
      });
      onUpdated((r) => ({ ...r, ...updated }));
      toast.success('Restaurant details updated');
      setOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update restaurant');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate uppercase tracking-wide">Restaurant Info</p>
          <button
            onClick={openModal}
            className="flex items-center gap-1 text-xs font-medium text-cobalt hover:underline"
          >
            <Pencil size={12} /> Edit
          </button>
        </div>
        <div className="space-y-1.5 text-sm">
          <p className="text-ink font-medium">{restaurant.name}</p>
          <p className="text-slate">{restaurant.email || 'No email on file'}</p>
          <p className="text-slate">{restaurant.phone || 'No phone on file'}</p>
          {restaurant.address && <p className="text-slate">{restaurant.address}</p>}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit restaurant info">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Restaurant name</label>
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
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Mobile number</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate mb-1">Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              rows={2}
              className="w-full border border-line rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-ink text-paper rounded px-3 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </Modal>
    </>
  );
}
