/**
 * Runtime configuration. Everything here is public — no secret ever belongs in
 * a Vite env var, since all `VITE_*` values are inlined into the built bundle.
 */

const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

/**
 * Base URL of the existing Tuition backend, including the `/api` suffix.
 * Mirrors `tuition-mobile/src/config/api.ts` so both clients hit the same host.
 */
export const API_URL = (raw && raw.length > 0 ? raw : 'https://hometuitionapp.com/api').replace(
  /\/+$/,
  ''
);

export const ENVIRONMENT =
  (import.meta.env.VITE_ENVIRONMENT as string | undefined)?.trim() ||
  (import.meta.env.DEV ? 'development' : 'production');

/** Key used for the persisted admin session in localStorage. */
export const SESSION_STORAGE_KEY = 'tuition.admin.session';
