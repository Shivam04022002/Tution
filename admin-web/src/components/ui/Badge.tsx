import type { ReactNode } from 'react';

export type BadgeTone = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'brand';

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

/**
 * Status vocabulary shared by the whole console. Labels use the same words the
 * backend and mobile app use, so nothing is renamed between clients.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  // Generic lifecycle
  active: 'success',
  inactive: 'neutral',
  published: 'success',
  draft: 'neutral',
  pending: 'warning',
  cancelled: 'neutral',
  expired: 'error',
  suspended: 'error',
  blocked: 'error',
  failed: 'error',
  completed: 'success',
  refunded: 'info',
  processing: 'warning',
  ready: 'success',

  // Verification / KYC
  verified: 'success',
  rejected: 'error',
  submitted: 'info',
  under_review: 'warning',
  reupload_required: 'warning',
  approved: 'success',

  // Tickets
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  closed: 'neutral',

  // Campaigns
  scheduled: 'info',
  sending: 'warning',
  sent: 'success',

  // Plans
  free: 'neutral',
  starter: 'info',
  professional: 'brand',
  premium: 'brand',
};

export function toneForStatus(status: string | undefined | null): BadgeTone {
  if (!status) return 'neutral';
  return STATUS_TONES[String(status).toLowerCase()] ?? 'neutral';
}

/** True only for values in the shared status vocabulary above — lets callers
 * tell a real status ("verified", "pending") apart from free text that
 * happens to be a plain lowercase word, so they don't badge everything. */
export function isKnownStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  return Object.prototype.hasOwnProperty.call(STATUS_TONES, String(status).toLowerCase());
}

/** Turns `under_review` into `Under review` without inventing new wording. */
export function humanizeStatus(status: string | undefined | null): string {
  if (!status) return '—';
  const text = String(status).replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function StatusBadge({ status, dot = true }: { status: string | undefined | null; dot?: boolean }) {
  return (
    <Badge tone={toneForStatus(status)} dot={dot}>
      {humanizeStatus(status)}
    </Badge>
  );
}
