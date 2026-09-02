import type { ReactNode } from 'react';
import { IconArrowDown, IconArrowUp, IconChevronLeft, IconChevronRight } from './Icons';
import type { Pagination as PaginationMeta } from '../../types';

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  width?: number | string;
}

export function TableHead({
  columns,
  sortKey,
  sortOrder,
  onSort,
}: {
  columns: Column[];
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}) {
  return (
    <thead>
      <tr>
        {columns.map((column) => {
          const sortable = column.sortable && onSort;
          const active = sortKey === column.key;
          return (
            <th
              key={column.key}
              className={[column.align === 'right' ? 'num' : '', sortable ? 'sortable' : '']
                .filter(Boolean)
                .join(' ')}
              style={column.width ? { width: column.width } : undefined}
              onClick={sortable ? () => onSort(column.key) : undefined}
              aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
            >
              <span
                className="row gap-1"
                style={{ justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start' }}
              >
                {column.label}
                {active &&
                  (sortOrder === 'asc' ? <IconArrowUp size={12} /> : <IconArrowDown size={12} />)}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/** Single full-width row used for empty and error states inside a table. */
export function TableMessageRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tbody>
      <tr>
        <td colSpan={colSpan} style={{ padding: 0 }}>
          {children}
        </td>
      </tr>
    </tbody>
  );
}

/**
 * Server-side pagination control. The console never pulls a whole collection
 * into the browser — every list endpoint on this backend is paginated, so the
 * page size is the server's.
 */
export function Pagination({
  pagination,
  onChange,
  itemLabel = 'records',
}: {
  pagination: PaginationMeta | undefined;
  onChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (!pagination || pagination.total === 0) return null;

  const { page, limit, total, pages } = pagination;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="pager">
      <span className="pager-info">
        Showing <strong>{first.toLocaleString()}</strong>–<strong>{last.toLocaleString()}</strong> of{' '}
        <strong>{total.toLocaleString()}</strong> {itemLabel}
      </span>

      {pages > 1 && (
        <div className="pager-pages">
          <button
            type="button"
            className="pager-btn"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <IconChevronLeft size={14} />
          </button>

          {pageWindow(page, pages).map((entry, index) =>
            entry === null ? (
              <span key={`gap-${index}`} className="dim" style={{ padding: '0 4px' }}>
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                className={`pager-btn${entry === page ? ' active' : ''}`}
                onClick={() => onChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
              >
                {entry}
              </button>
            )
          )}

          <button
            type="button"
            className="pager-btn"
            onClick={() => onChange(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
          >
            <IconChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Compact page list: first, last, and a window around the current page. */
function pageWindow(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const output: Array<number | null> = [];

  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) output.push(null);
    output.push(value);
  });

  return output;
}
