/**
 * Search radius configuration — the single source of truth for radius-based
 * discovery on both sides of the marketplace (parent→teachers, teacher→students).
 *
 * Add a new value here and it becomes available everywhere; never hard-code a
 * radius anywhere else in the codebase.
 */

/** Selectable radii, in kilometres. Must stay sorted ascending. */
export const SEARCH_RADIUS_OPTIONS_KM = [1, 1.5, 2, 2.5, 3, 5, 10] as const;

export type SearchRadiusKm = (typeof SEARCH_RADIUS_OPTIONS_KM)[number];

export const DEFAULT_SEARCH_RADIUS_KM = 2;

/** Hard bounds. Requests outside this range are clamped rather than rejected. */
export const MIN_SEARCH_RADIUS_KM = SEARCH_RADIUS_OPTIONS_KM[0];
export const MAX_SEARCH_RADIUS_KM = 50;

/**
 * Coerce an arbitrary query value into a usable radius in kilometres.
 * Falsy/invalid input falls back to the default rather than failing the search.
 */
export const parseRadiusKm = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SEARCH_RADIUS_KM;
  }

  return Math.min(MAX_SEARCH_RADIUS_KM, Math.max(MIN_SEARCH_RADIUS_KM, parsed));
};

/** MongoDB geospatial operators work in metres. */
export const kmToMeters = (km: number): number => km * 1000;

export const metersToKm = (meters: number): number => meters / 1000;

/** Distances are reported to two decimals, e.g. 0.42 km. */
export const roundDistanceKm = (km: number): number => Math.round(km * 100) / 100;
