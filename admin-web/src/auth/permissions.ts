/**
 * Frontend permission model.
 *
 * IMPORTANT: this only shapes the UI. The backend is the source of truth —
 * every `/api/admin/*` route is wrapped in `authenticate + authorize('admin')`,
 * so hiding a menu item here never grants or withholds actual access. A user
 * who types a URL by hand still gets a 403 from the server.
 *
 * `User.permissions` is a free-form `string[]` on the existing model. It is not
 * enforced server-side today, so it is treated as an optional narrowing hint:
 * an admin with no list sees everything, an admin with a list sees only what it
 * names (plus anything under a wildcard).
 */

export const PERMISSIONS = {
  dashboard: 'dashboard.view',
  users: 'users.view',
  tutors: 'tutors.view',
  verification: 'verification.view',
  marketplace: 'marketplace.view',
  finance: 'finance.view',
  engagement: 'engagement.view',
  support: 'support.view',
  reports: 'reports.view',
  settings: 'settings.view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * True when `granted` allows `permission`. Supports exact matches, the `*`
 * wildcard and namespace wildcards such as `finance.*`.
 */
export function permissionGranted(granted: string[] | undefined | null, permission: Permission) {
  // No explicit list configured on the account → full admin surface.
  if (!granted || granted.length === 0) return true;
  if (granted.includes('*') || granted.includes('all')) return true;
  if (granted.includes(permission)) return true;

  const namespace = permission.split('.')[0];
  return granted.includes(`${namespace}.*`) || granted.includes(namespace);
}
