import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Star } from 'lucide-react';

import { restaurantApi } from '@/api/restaurant';

function StarRow({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? 'fill-saffron text-saffron' : 'text-line'}
        />
      ))}
    </div>
  );
}

export default function Feedback() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [minRating, setMinRating] = useState('');

  useEffect(() => {
    setLoading(true);
    restaurantApi
      .listFeedback(minRating ? { minRating } : {})
      .then(setData)
      .catch(() => toast.error('Failed to load feedback'))
      .finally(() => setLoading(false));
  }, [minRating]);

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-ink">Feedback</h1>
        {data?.avgRating != null && (
          <div className="flex items-center gap-1.5">
            <StarRow rating={Math.round(data.avgRating)} />
            <span className="text-sm text-slate font-mono">{data.avgRating.toFixed(1)}</span>
          </div>
        )}
      </div>
      <p className="text-sm text-slate mb-4">What customers are saying, straight from the table.</p>

      <div className="flex gap-1 mb-4">
        {['', '4', '3'].map((v) => (
          <button
            key={v}
            onClick={() => setMinRating(v)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
              minRating === v ? 'bg-ink text-paper border-ink' : 'border-line text-slate'
            }`}
          >
            {v === '' ? 'All' : `${v}★ and up`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate">Loading…</p>
      ) : !data?.feedback?.length ? (
        <p className="text-sm text-slate">No feedback yet.</p>
      ) : (
        <div className="space-y-3">
          {data.feedback.map((f) => (
            <div key={f.id} className="ticket-edge bg-white border border-line rounded-ticket p-4 mt-2">
              <div className="flex items-center justify-between mb-1.5">
                <StarRow rating={f.rating} />
                <span className="text-xs text-slate">
                  {f.table?.tableNumber ? `Table ${f.table.tableNumber} · ` : ''}
                  {new Date(f.createdAt).toLocaleDateString()}
                </span>
              </div>
              {f.comment && <p className="text-sm text-ink">{f.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
