import { REVENUE_RANGES } from '../../utils/constants';
import type { RevenueRange } from '../../types';

/**
 * Period selector shared by the finance screens. Matches the `range` values the
 * revenue endpoints accept; `custom` additionally sends `from` and `to`.
 */
export function RangeFilter({
  range,
  from,
  to,
  onChange,
}: {
  range: RevenueRange;
  from: string;
  to: string;
  onChange: (next: { range?: RevenueRange; from?: string; to?: string }) => void;
}) {
  return (
    <div className="row gap-2 wrap">
      <div className="row gap-1" role="group" aria-label="Period">
        {REVENUE_RANGES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`pager-btn${range === option.value ? ' active' : ''}`}
            style={{ height: 34, padding: '0 12px' }}
            onClick={() => onChange({ range: option.value as RevenueRange })}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className={`pager-btn${range === 'custom' ? ' active' : ''}`}
          style={{ height: 34, padding: '0 12px' }}
          onClick={() => onChange({ range: 'custom' })}
        >
          Custom
        </button>
      </div>

      {range === 'custom' && (
        <div className="row gap-2">
          <input
            type="date"
            className="control"
            style={{ width: 160 }}
            aria-label="From date"
            value={from}
            max={to || undefined}
            onChange={(event) => onChange({ from: event.target.value })}
          />
          <span className="dim">to</span>
          <input
            type="date"
            className="control"
            style={{ width: 160 }}
            aria-label="To date"
            value={to}
            min={from || undefined}
            onChange={(event) => onChange({ to: event.target.value })}
          />
        </div>
      )}
    </div>
  );
}

/** Reads range/from/to out of the URL params helper into a filters object. */
export function useRangeFilters(get: (key: string) => string) {
  const range = (get('range') || '30d') as RevenueRange;
  const from = get('from');
  const to = get('to');
  return { filters: { range, from, to }, range, from, to };
}
