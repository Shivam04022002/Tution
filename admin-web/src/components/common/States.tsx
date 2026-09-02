import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { IconAlert, IconInbox, IconRefresh } from '../ui/Icons';
import { ApiError } from '../../api/client';

/** Full-viewport loader used while the session is being restored. */
export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--c-primary)',
      }}
    >
      <span className="spinner spinner-lg" />
      {label && <span className="muted text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="state">
      <span className="state-icon">{icon ?? <IconInbox size={32} />}</span>
      <p className="state-title">{title}</p>
      {message && <p className="state-msg">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Error surface for a failed load. Keeps the backend's own message — it is
 * usually more specific than anything the console could invent — and offers a
 * retry whenever the failure could plausibly be transient.
 */
export function ErrorState({
  error,
  title,
  message,
  onRetry,
}: {
  error?: unknown;
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const heading = title ?? headingFor(apiError);
  const detail = message ?? (error instanceof Error ? error.message : 'Something went wrong.');
  const canRetry = onRetry && (!apiError || apiError.isRetryable || apiError.status === 404);

  return (
    <div className="state">
      <span className="state-icon" style={{ color: 'var(--c-error)' }}>
        <IconAlert size={32} />
      </span>
      <p className="state-title">{heading}</p>
      <p className="state-msg">{detail}</p>
      {canRetry && (
        <div className="mt-2">
          <Button variant="secondary" icon={<IconRefresh size={14} />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

function headingFor(error: ApiError | null) {
  if (!error) return 'Could not load this view';
  switch (error.status) {
    case 0:
      return 'No connection to the server';
    case 403:
      return 'Permission denied';
    case 404:
      return 'Not found';
    case 429:
      return 'Rate limited';
    default:
      return error.status >= 500 ? 'Server error' : 'Could not load this view';
  }
}

/** Table body placeholder that keeps the column layout stable while loading. */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: cols }).map((__, colIndex) => (
            <td key={colIndex}>
              <div
                className="skel"
                style={{ height: 12, width: colIndex === 0 ? '70%' : '45%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function CardSkeleton({ height = 96 }: { height?: number }) {
  return <div className="card skel" style={{ height, border: 'none' }} />;
}

export function InlineLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="row gap-2 muted text-sm" style={{ padding: 'var(--s-6)', justifyContent: 'center' }}>
      <span className="spinner" style={{ color: 'var(--c-primary)' }} />
      {label}
    </div>
  );
}
