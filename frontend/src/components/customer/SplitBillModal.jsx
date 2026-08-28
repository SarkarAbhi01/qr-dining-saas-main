import { useState } from 'react';
import toast from 'react-hot-toast';

import Modal from '@/components/Modal';
import { customerApi } from '@/api/customer';

const OPTIONS = [
  { value: 'FULL', label: 'Pay in full', hint: 'One person pays everything' },
  { value: 'EQUAL', label: 'Split equally', hint: 'Divide evenly between guests' },
  { value: 'CUSTOM', label: 'Custom split', hint: 'Set a specific amount per guest' },
];

export default function SplitBillModal({ open, onClose, sessionId, total, onSplit }) {
  const [splitType, setSplitType] = useState('FULL');
  const [numberOfShares, setNumberOfShares] = useState(2);
  const [customShares, setCustomShares] = useState([{ label: 'Guest 1', amount: '' }, { label: 'Guest 2', amount: '' }]);
  const [submitting, setSubmitting] = useState(false);

  function updateCustomAmount(index, amount) {
    setCustomShares((rows) => rows.map((r, i) => (i === index ? { ...r, amount } : r)));
  }

  function addCustomRow() {
    setCustomShares((rows) => [...rows, { label: `Guest ${rows.length + 1}`, amount: '' }]);
  }

  const customSum = customShares.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const payload =
        splitType === 'FULL'
          ? { splitType: 'FULL' }
          : splitType === 'EQUAL'
          ? { splitType: 'EQUAL', numberOfShares }
          : { splitType: 'CUSTOM', shares: customShares.map((r) => ({ label: r.label, amount: Number(r.amount) })) };

      const result = await customerApi.splitBill(sessionId, payload);
      toast.success('Bill split confirmed');
      onSplit(result);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to split bill');
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirm = splitType !== 'CUSTOM' || Math.abs(customSum - total) < 0.5;

  return (
    <Modal open={open} onClose={onClose} title="Split the bill">
      <p className="text-sm text-slate mb-4">
        Total: <span className="font-mono text-ink">₹{total.toFixed(2)}</span>
      </p>

      <div className="space-y-2 mb-4">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setSplitType(o.value)}
            className={`w-full text-left border rounded-ticket px-4 py-3 transition-colors ${
              splitType === o.value ? 'border-ink bg-paper-dim' : 'border-line'
            }`}
          >
            <p className="text-sm font-medium text-ink">{o.label}</p>
            <p className="text-xs text-slate">{o.hint}</p>
          </button>
        ))}
      </div>

      {splitType === 'EQUAL' && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate mb-1">Number of guests</label>
          <input
            type="number"
            min="2"
            max="20"
            value={numberOfShares}
            onChange={(e) => setNumberOfShares(Number(e.target.value))}
            className="w-full border border-line rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate mt-1">₹{(total / numberOfShares).toFixed(2)} per guest</p>
        </div>
      )}

      {splitType === 'CUSTOM' && (
        <div className="mb-4 space-y-2">
          {customShares.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={row.label}
                onChange={(e) =>
                  setCustomShares((rows) => rows.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)))
                }
                className="flex-1 border border-line rounded px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="₹0.00"
                value={row.amount}
                onChange={(e) => updateCustomAmount(i, e.target.value)}
                className="w-24 border border-line rounded px-3 py-2 text-sm"
              />
            </div>
          ))}
          <button onClick={addCustomRow} className="text-xs text-cobalt hover:underline">
            + Add another guest
          </button>
          <p className={`text-xs ${Math.abs(customSum - total) < 0.5 ? 'text-basil' : 'text-chili'}`}>
            {customSum.toFixed(2)} / {total.toFixed(2)}
          </p>
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={submitting || !canConfirm}
        className="customer-menu-btn w-full rounded px-3 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {submitting ? 'Confirming…' : 'Confirm split'}
      </button>
    </Modal>
  );
}
