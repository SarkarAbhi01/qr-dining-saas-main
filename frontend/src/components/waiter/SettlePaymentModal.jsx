import { useState } from 'react';
import toast from 'react-hot-toast';
import { Banknote, Smartphone, CreditCard, MoreHorizontal, Check, Printer, Tag } from 'lucide-react';

import Modal from '@/components/Modal';
import { waiterApi } from '@/api/waiter';
import { printReceipt, buildBillHtml } from '@/utils/print';
import { useAuthStore } from '@/store/authStore';

const METHODS = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'CARD', label: 'Online / Card', icon: CreditCard },
  { value: 'OTHER', label: 'Other', icon: MoreHorizontal },
];

export default function SettlePaymentModal({ open, onClose, table, onSettled }) {
  const [method, setMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const role = useAuthStore((s) => s.user?.role);
  // Matches the backend policy exactly (waiter.controller.js) — a
  // Waiter can collect payment but can't unilaterally discount a bill,
  // since that directly affects revenue.
  const canDiscount = role === 'OWNER' || role === 'MANAGER';

  const due = Number(table?.session?.totalAmount || 0);
  const discount = Math.min(Number(discountAmount) || 0, due);
  const payable = Math.max(0, due - discount);

  async function handlePrintBill() {
    setPrinting(true);
    try {
      const { restaurant, table: t, orders } = await waiterApi.getTableBill(table.id);
      // Print the amount the guest will actually be charged (net of
      // any discount already entered in this modal) — the receipt
      // itself never labels it as a discount, it just shows the right
      // final total, same as after settlement.
      printReceipt(buildBillHtml({ restaurant, table: t, orders, amountPaid: discount > 0 ? payable : undefined }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load bill for printing');
    } finally {
      setPrinting(false);
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await waiterApi.settleTablePayment(table.id, method, {
        discountAmount: discount > 0 ? discount : undefined,
        discountReason: discount > 0 ? discountReason || undefined : undefined,
      });
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
      <p className={`font-display text-3xl text-ink ${discount > 0 ? 'line-through text-slate/60 text-2xl' : 'mb-5'}`}>
        ₹{due.toFixed(2)}
      </p>
      {discount > 0 && (
        <p className="font-display text-3xl text-basil mb-5">₹{payable.toFixed(2)} <span className="text-sm text-slate font-sans">after discount</span></p>
      )}

      <button
        onClick={handlePrintBill}
        disabled={printing}
        className="w-full flex items-center justify-center gap-2 border border-line rounded-ticket px-4 py-2.5 text-sm font-medium mb-3 disabled:opacity-50"
      >
        <Printer size={15} /> {printing ? 'Preparing…' : 'Print bill'}
      </button>

      {canDiscount && (
        <div className="mb-5">
          {!showDiscount ? (
            <button
              onClick={() => setShowDiscount(true)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-line rounded-ticket px-4 py-2.5 text-sm font-medium text-slate hover:border-ink hover:text-ink"
            >
              <Tag size={14} /> Apply a discount
            </button>
          ) : (
            <div className="border border-line rounded-ticket p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate">₹</span>
                <input
                  type="number"
                  min="0"
                  max={due}
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="flex-1 border border-line rounded px-3 py-2 text-sm"
                />
              </div>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Reason (optional) — e.g. rounded off, loyal customer"
                className="w-full border border-line rounded px-3 py-2 text-sm"
              />
              <button
                onClick={() => {
                  setShowDiscount(false);
                  setDiscountAmount('');
                  setDiscountReason('');
                }}
                className="text-xs text-slate hover:text-chili"
              >
                Remove discount
              </button>
            </div>
          )}
        </div>
      )}

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
        <Check size={16} />
        {submitting ? 'Recording…' : `Confirm ₹${payable.toFixed(2)} received`}
      </button>
    </Modal>
  );
}
