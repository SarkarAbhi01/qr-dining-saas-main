import { useState } from 'react';
import toast from 'react-hot-toast';
import { Banknote, Smartphone, CreditCard, MoreHorizontal, Check } from 'lucide-react';

import Modal from '@/components/Modal';
import { waiterApi } from '@/api/waiter';

const METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'CARD', label: 'Online / Card', icon: CreditCard },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal },
];

export default function SettlePaymentModal({ open, onClose, table, onSettled }) {
  const [method, setMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await waiterApi.settleTablePayment(table.id, method);
      toast.success(result.message || 'Payment recorded');
      onSettled?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  }

  if (!table) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Collect payment — Table ${table.tableNumber}`}>
      <p className="text-sm text-slate mb-1">Amount due</p>
      <p className="font-display text-3xl text-ink mb-5">₹{Number(table.session?.totalAmount || 0).toFixed(2)}</p>

      <p className="text-xs font-medium text-slate mb-2">How did the guest pay?</p>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = method === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={`flex items-center gap-2 rounded-ticket border px-3 py-3 text-sm font-medium transition-colors ${
                active ? 'border-ink bg-ink text-paper' : 'border-line text-ink hover:border-ink'
              }`}
            >
              <Icon size={16} /> {m.label}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleConfirm}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 bg-basil text-white rounded-ticket px-4 py-3 text-sm font-medium disabled:opacity-50"
      >
        <Check size={16} /> {submitting ? 'Recording…' : 'Confirm payment received'}
      </button>
    </Modal>
  );
}
