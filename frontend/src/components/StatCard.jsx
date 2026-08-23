export default function StatCard({ label, value, accent = 'ink', hint }) {
  const accentMap = {
    ink: 'text-ink',
    basil: 'text-basil',
    chili: 'text-chili',
    saffron: 'text-saffron-dark',
    cobalt: 'text-cobalt',
  };
  return (
    <div className="ticket-edge bg-white border border-line rounded-ticket p-5 mt-2">
      <p className="text-xs font-medium text-slate uppercase tracking-wide mb-2">{label}</p>
      <p className={`font-display text-3xl ${accentMap[accent] || accentMap.ink}`}>{value}</p>
      {hint && <p className="text-xs text-slate mt-1">{hint}</p>}
    </div>
  );
}
