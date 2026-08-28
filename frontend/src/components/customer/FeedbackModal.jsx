import { useState } from 'react';
import { Star, MessageSquareWarning } from 'lucide-react';
import toast from 'react-hot-toast';

import Modal from '@/components/Modal';
import { customerApi } from '@/api/customer';

const TYPE_OPTIONS = [
  { value: 'REVIEW', label: 'Feedback', hint: 'Tell us how it went' },
  { value: 'COMPLAINT', label: 'Complaint', hint: 'Something wasn\'t right' },
];

export default function FeedbackModal({ open, onClose, sessionId }) {
  const [type, setType] = useState('REVIEW');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await customerApi.submitFeedback(sessionId, { type, rating, comment: comment.trim() || undefined });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    onClose();
    // Reset for next open, after the close animation has a moment to run.
    setTimeout(() => {
      setSubmitted(false);
      setType('REVIEW');
      setRating(5);
      setComment('');
    }, 200);
  }

  if (submitted) {
    return (
      <Modal open={open} onClose={handleClose} title="Thank you">
        <p className="text-sm text-slate">
          Your {type === 'COMPLAINT' ? 'complaint' : 'feedback'} has been sent to the restaurant. We
          appreciate you taking the time.
        </p>
        <button
          onClick={handleClose}
          className="customer-menu-btn mt-4 w-full rounded px-3 py-2.5 text-sm font-medium"
        >
          Close
        </button>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Share your experience">
      <div className="flex gap-2 mb-4">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setType(opt.value)}
            className={`flex-1 text-left border rounded-ticket p-3 transition-colors ${
              type === opt.value ? 'border-ink bg-paper-dim' : 'border-line'
            }`}
          >
            <p className="text-sm font-medium text-ink">{opt.label}</p>
            <p className="text-[11px] text-slate">{opt.hint}</p>
          </button>
        ))}
      </div>

      {type === 'REVIEW' && (
        <div className="flex items-center justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} aria-label={`${n} star`}>
              <Star
                size={28}
                className={n <= rating ? 'fill-saffron text-saffron' : 'text-line'}
              />
            </button>
          ))}
        </div>
      )}

      {type === 'COMPLAINT' && (
        <div className="flex items-start gap-2 bg-chili-soft border border-chili/20 rounded-ticket p-3 mb-4">
          <MessageSquareWarning className="text-chili shrink-0 mt-0.5" size={16} />
          <p className="text-xs text-ink">
            This goes straight to the restaurant's owner/manager so they can follow up.
          </p>
        </div>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={type === 'COMPLAINT' ? 'What went wrong?' : 'Anything you\'d like to add? (optional)'}
        rows={3}
        className="w-full border border-line rounded px-3 py-2 text-sm mb-4"
      />

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="customer-menu-btn w-full rounded px-3 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {submitting ? 'Sending…' : `Send ${type === 'COMPLAINT' ? 'complaint' : 'feedback'}`}
      </button>
    </Modal>
  );
}
