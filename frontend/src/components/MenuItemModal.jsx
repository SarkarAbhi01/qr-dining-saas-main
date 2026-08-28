import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import Modal from '@/components/Modal';
import { restaurantApi } from '@/api/restaurant';

const TYPE_OPTIONS = [
  { value: 'VEG', label: 'Veg' },
  { value: 'NON_VEG', label: 'Non-veg' },
  { value: 'EGG', label: 'Egg' },
  { value: 'VEGAN', label: 'Vegan' },
];

const emptyForm = {
  name: '',
  description: '',
  price: '',
  hasHalfFull: false,
  halfPrice: '',
  type: 'VEG',
  categoryId: '',
  spiceLevel: '',
  preparationMinutes: '',
};

export default function MenuItemModal({ open, onClose, categories, editingItem, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setForm({
        name: editingItem.name,
        description: editingItem.description || '',
        price: editingItem.price,
        hasHalfFull: editingItem.hasHalfFull || false,
        halfPrice: editingItem.halfPrice ?? '',
        type: editingItem.type,
        categoryId: editingItem.categoryId,
        spiceLevel: editingItem.spiceLevel ?? '',
        preparationMinutes: editingItem.preparationMinutes ?? '',
      });
      setPreview(editingItem.imageUrl || null);
      setImageFile(null);
    } else {
      setForm({ ...emptyForm, categoryId: categories[0]?.id || '' });
      setPreview(null);
      setImageFile(null);
    }
  }, [editingItem, open, categories]);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null) fd.append(k, v);
      });
      if (imageFile) fd.append('image', imageFile);

      if (editingItem) {
        await restaurantApi.updateMenuItem(editingItem.id, fd);
        toast.success('Item updated');
      } else {
        await restaurantApi.createMenuItem(fd);
        toast.success('Item added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editingItem ? 'Edit item' : 'New menu item'} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4 items-start">
          <label className="shrink-0 w-24 h-24 rounded-ticket border border-dashed border-line bg-paper-dim flex items-center justify-center cursor-pointer overflow-hidden">
            {preview ? (
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] text-slate text-center px-2">Add photo</span>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
          </label>

          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate mb-1">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate mb-1">
                  {form.hasHalfFull ? 'Full price (₹)' : 'Price (₹)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full border border-line rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Category</label>
                <select
                  required
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full border border-line rounded px-3 py-2 text-sm bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasHalfFull}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hasHalfFull: e.target.checked, halfPrice: e.target.checked ? f.halfPrice : '' }))
                }
                className="rounded border-line"
              />
              Offer Half &amp; Full portions
            </label>

            {form.hasHalfFull && (
              <div>
                <label className="block text-xs font-medium text-slate mb-1">Half price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required={form.hasHalfFull}
                  value={form.halfPrice}
                  onChange={(e) => setForm((f) => ({ ...f, halfPrice: e.target.value }))}
                  placeholder="Must be less than Full price"
                  className="w-full border border-line rounded px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate mb-1">Description</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full border border-line rounded px-3 py-2 text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate mb-2">Type</label>
          <div className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  form.type === t.value ? 'staff-menu-active border-transparent' : 'border-line text-slate hover:border-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !form.categoryId}
          className="staff-menu-btn w-full rounded px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving…' : editingItem ? 'Save changes' : 'Add item'}
        </button>
      </form>
    </Modal>
  );
}
