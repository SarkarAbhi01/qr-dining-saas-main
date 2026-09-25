import { Search } from 'lucide-react';

/**
 * A small, deliberately generic toolbar so Menu/Tables/Kitchen/Waiter
 * don't each reinvent their own search box + dropdowns. Purely
 * presentational — every page keeps owning its own `search`/`sort`/
 * filter state and does the actual filtering itself, this component
 * just renders the controls and calls back on change.
 *
 * `filters` is an array of { key, label, value, onChange, options }
 * where `options` is [{ value, label }, ...] (include an "All ___"
 * option yourself if you want one).
 *
 * `dark`, when true, switches to light-on-dark styling for KDS, which
 * runs on a fixed dark "ink" background unlike every other screen.
 */
export default function SearchSortFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  sortOptions,
  sortValue,
  onSortChange,
  filters = [],
  dark = false,
  className = '',
}) {
  const inputClass = dark
    ? 'bg-white/5 border-white/10 text-paper placeholder:text-paper/40 focus:border-white/30'
    : 'bg-white border-line text-ink placeholder:text-slate/60 focus:border-ink';
  const selectClass = dark
    ? 'bg-white/5 border-white/10 text-paper focus:border-white/30'
    : 'bg-white border-line text-ink focus:border-ink';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {onSearchChange && (
        <div className="relative flex-1 min-w-[160px]">
          <Search
            size={14}
            className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${dark ? 'text-paper/40' : 'text-slate/60'}`}
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`w-full border rounded pl-8 pr-3 py-2 text-sm outline-none transition-colors ${inputClass}`}
          />
        </div>
      )}

      {filters.map((f) => (
        <select
          key={f.key}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className={`border rounded px-2.5 py-2 text-sm outline-none transition-colors ${selectClass}`}
          title={f.label}
        >
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {sortOptions && (
        <select
          value={sortValue}
          onChange={(e) => onSortChange(e.target.value)}
          className={`border rounded px-2.5 py-2 text-sm outline-none transition-colors ${selectClass}`}
          title="Sort by"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
