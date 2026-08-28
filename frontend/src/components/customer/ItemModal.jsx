import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import { useCartStore } from '@/store/cartStore';

export default function ItemModal({ open, onClose, item }) {
  const addItem = useCartStore((s) => s.addItem);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState({}); // { [groupId]: Set(optionId) }
  const [portion, setPortion] = useState('FULL');

  // Reset portion choice whenever a new item is opened.
  useEffect(() => setPortion('FULL'), [item?.id]);

  if (!item) return null;

  function toggleOption(group, optionId) {
    setSelected((prev) => {
      const current = new Set(prev[group.id] || []);
      if (group.maxSelect === 1) {
        // single-select group behaves like radio buttons
        return { ...prev, [group.id]: current.has(optionId) ? new Set() : new Set([optionId]) };
      }
      if (current.has(optionId)) current.delete(optionId);
      else if (current.size < group.maxSelect) current.add(optionId);
      return { ...prev, [group.id]: current };
    });
  }

  const chosenOptionIds = Object.values(selected).flatMap((s) => [...s]);
  const extraTotal = (item.modifierGroups || [])
    .flatMap((g) => g.options)
    .filter((o) => chosenOptionIds.includes(o.id))
    .reduce((sum, o) => sum + Number(o.extraPrice), 0);
  const basePrice = item.hasHalfFull && portion === 'HALF' ? Number(item.halfPrice) : Number(item.price);
  const unitPrice = basePrice + extraTotal;

  const canAdd = (item.modifierGroups || []).every((g) => {
    const count = (selected[g.id] || new Set()).size;
    return count >= g.minSelect;
  });

  function handleAdd() {
    const modifierLabel = (item.modifierGroups || [])
      .flatMap((g) => g.options)
      .filter((o) => chosenOptionIds.includes(o.id))
      .map((o) => o.name)
      .join(', ');

    addItem({
      menuItemId: item.id,
      name: item.name,
      unitPrice,
      quantity,
      portion: item.hasHalfFull ? portion : 'FULL',
      notes: notes.trim(),
      modifierOptionIds: chosenOptionIds,
      modifierLabel,
    });
    onClose();
    setQuantity(1);
    setNotes('');
    setSelected({});
    setPortion('FULL');
  }

  return (
    <Modal open={open} onClose={onClose} title={item.name} maxWidth="max-w-md">
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.name} className="w-full h-40 object-cover rounded-ticket mb-3" />
      )}
      {item.description && <p className="text-sm text-slate mb-4">{item.description}</p>}

      {item.hasHalfFull && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-ink uppercase tracking-wide mb-2">Portion</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'HALF', label: 'Half', price: item.halfPrice },
              { value: 'FULL', label: 'Full', price: item.price },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPortion(opt.value)}
                className={`flex items-center justify-between border rounded px-3 py-2 text-sm ${
                  portion === opt.value ? 'border-ink bg-paper-dim' : 'border-line'
                }`}
              >
                <span>{opt.label}</span>
                <span className="font-mono text-xs text-slate">₹{Number(opt.price).toFixed(0)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(item.modifierGroups || []).map((group) => (
        <div key={group.id} className="mb-4">
          <p className="text-xs font-semibold text-ink uppercase tracking-wide mb-2">
            {group.name} {group.minSelect > 0 && <span className="text-chili">*</span>}
          </p>
          <div className="space-y-1.5">
            {group.options.map((opt) => {
              const isChecked = (selected[group.id] || new Set()).has(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex items-center justify-between border rounded px-3 py-2 text-sm cursor-pointer ${
                    isChecked ? 'border-ink bg-paper-dim' : 'border-line'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type={group.maxSelect === 1 ? 'radio' : 'checkbox'}
                      checked={isChecked}
                      onChange={() => toggleOption(group, opt.id)}
                    />
                    {opt.name}
                  </span>
                  {Number(opt.extraPrice) > 0 && (
                    <span className="text-slate font-mono text-xs">+₹{Number(opt.extraPrice)}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mb-4">
        <label className="block text-xs font-medium text-slate mb-1">Special instructions</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Make it spicy, no onions"
          rows={2}
          className="w-full border border-line rounded px-3 py-2 text-sm resize-none"
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-slate">Quantity</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-8 h-8 rounded-full border border-line text-ink"
          >
            −
          </button>
          <span className="font-mono w-4 text-center">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="w-8 h-8 rounded-full border border-line text-ink"
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={handleAdd}
        disabled={!canAdd}
        className="customer-menu-btn w-full rounded px-3 py-3 text-sm font-medium disabled:opacity-50"
      >
        Add {quantity} to cart · ₹{(unitPrice * quantity).toFixed(2)}
      </button>
    </Modal>
  );
}
