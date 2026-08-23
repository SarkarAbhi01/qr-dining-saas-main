import { Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import Modal from '@/components/Modal';

export default function CredentialRevealModal({ open, onClose, email, temporaryPassword }) {
  const [copied, setCopied] = useState(false);

  function copyAll() {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${temporaryPassword}`);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open={open} onClose={onClose} title="Account created">
      <div className="flex items-start gap-3 bg-basil-soft border border-basil/20 rounded-ticket p-4 mb-4">
        <CheckCircle2 className="text-basil shrink-0 mt-0.5" size={18} />
        <p className="text-sm text-ink">
          Share these credentials securely — the password is shown only this once and cannot be
          retrieved again.
        </p>
      </div>

      <div className="space-y-3 font-mono text-sm">
        <div className="flex justify-between border-b border-line pb-2">
          <span className="text-slate">Email</span>
          <span className="text-ink">{email}</span>
        </div>
        <div className="flex justify-between border-b border-line pb-2">
          <span className="text-slate">Temp password</span>
          <span className="text-ink font-semibold">{temporaryPassword}</span>
        </div>
      </div>

      <button
        onClick={copyAll}
        className="mt-5 w-full flex items-center justify-center gap-2 bg-ink text-paper rounded px-3 py-2.5 text-sm font-medium hover:bg-ink-soft transition-colors"
      >
        <Copy size={14} />
        {copied ? 'Copied' : 'Copy credentials'}
      </button>
    </Modal>
  );
}
