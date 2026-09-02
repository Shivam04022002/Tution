/** Display helpers. Currency is INR throughout — the platform's only currency. */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | undefined | null, precise = false): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return precise ? inrPrecise.format(value) : inr.format(value);
}

/** Compacts large money figures for KPI tiles: ₹1.2L, ₹3.4Cr. */
export function formatCurrencyCompact(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return inr.format(value);
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-IN');
}

export function formatPercent(value: number | undefined | null, digits = 1): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatDate(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

/** Seconds → `1h 04m` / `12m 30s`, used for lesson and course video runtimes. */
export function formatDuration(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return '—';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(secs).padStart(2, '0')}s`;
  return `${secs}s`;
}

export function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Full name from the `profile` sub-document both user shapes carry. */
export function fullName(profile?: { firstName?: string; lastName?: string } | null): string {
  if (!profile) return '—';
  const name = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
  return name || '—';
}

/** Phone, normalised across the two coexisting user document shapes. */
export function userPhone(user: { mobileNumber?: string; phoneNumber?: string }): string {
  return user.mobileNumber ?? user.phoneNumber ?? '—';
}

export function userVerified(user: {
  isEmailVerified?: boolean;
  isMobileVerified?: boolean;
  isVerified?: boolean;
}): boolean {
  return user.isEmailVerified === true || user.isMobileVerified === true || user.isVerified === true;
}

/** `snake_case` / `kebab-case` → `Title case`, for backend enum values. */
export function humanize(value: string | undefined | null): string {
  if (!value) return '—';
  const text = String(value).replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
