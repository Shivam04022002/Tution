import { PipelineStage } from 'mongoose';
import { validateLocationCoordinates } from './locationService';
import { parseRadiusKm, kmToMeters, roundDistanceKm } from '../config/searchRadius';

/**
 * Geospatial search helpers shared by both discovery directions:
 *   parent → nearby teachers   (TeacherProfile.locationAvailability.geoPoint)
 *   teacher → nearby students  (ParentRequirement.location.geoPoint)
 *
 * All radius filtering, distance calculation and proximity ordering is done by
 * MongoDB via $geoNear — never by looping in JavaScript.
 */

export interface GeoSearchParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface GeoSearchParseResult {
  /** Present only when a complete, valid location was supplied. */
  geo?: GeoSearchParams;
  /** Set when the caller supplied location input that failed validation. */
  error?: string;
}

/**
 * Read latitude/longitude/radius off a query object.
 *
 * Location is optional: when absent the caller should fall back to its existing
 * non-geo search path, so adding radius support never breaks existing clients.
 * When latitude/longitude are supplied but invalid, that is a 400 — silently
 * ignoring a bad location would show the user the wrong results.
 */
export const parseGeoSearchParams = (query: Record<string, any>): GeoSearchParseResult => {
  const rawLat = query.latitude ?? query.lat;
  const rawLng = query.longitude ?? query.lng;

  const hasLat = rawLat !== undefined && rawLat !== null && String(rawLat).trim() !== '';
  const hasLng = rawLng !== undefined && rawLng !== null && String(rawLng).trim() !== '';

  if (!hasLat && !hasLng) {
    return {};
  }

  if (!hasLat || !hasLng) {
    return { error: 'Both latitude and longitude are required for a nearby search' };
  }

  const latitude = parseFloat(String(rawLat));
  const longitude = parseFloat(String(rawLng));

  const validation = validateLocationCoordinates(latitude, longitude);
  if (!validation.valid) {
    return { error: validation.errors.join(', ') };
  }

  return {
    geo: {
      latitude,
      longitude,
      radiusKm: parseRadiusKm(query.radius ?? query.radiusKm),
    },
  };
};

/**
 * Build the `$geoNear` stage.
 *
 * $geoNear must be the FIRST stage of an aggregation pipeline, and it applies
 * its `query` as part of the same index scan — so existing eligibility filters
 * are combined with the radius condition rather than applied afterwards.
 *
 * Note the GeoJSON coordinate order: [longitude, latitude].
 */
export const buildGeoNearStage = (options: {
  geo: GeoSearchParams;
  /** Path of the GeoJSON point field, e.g. 'locationAvailability.geoPoint'. */
  path: string;
  /** Existing eligibility conditions, merged into the geo query. */
  query: Record<string, any>;
  /** Field name to receive the computed distance, in metres. */
  distanceField?: string;
}): PipelineStage.GeoNear => {
  const { geo, path, query, distanceField = 'distanceMeters' } = options;

  return {
    $geoNear: {
      near: {
        type: 'Point',
        coordinates: [geo.longitude, geo.latitude],
      },
      distanceField,
      maxDistance: kmToMeters(geo.radiusKm),
      key: path,
      // Everything the non-geo path would have filtered on still applies.
      query,
      // $geoNear always returns results sorted nearest-first.
      spherical: true,
    },
  };
};

/**
 * Convert the metres emitted by $geoNear into the km value the API exposes.
 * The backend's distance is the source of truth — clients must not recompute it.
 */
export const attachDistanceKm = <T extends Record<string, any>>(
  docs: T[],
  distanceField = 'distanceMeters'
): Array<T & { distanceKm: number }> =>
  docs.map((doc) => {
    const meters = Number(doc[distanceField]) || 0;
    const { [distanceField]: _omit, ...rest } = doc as Record<string, any>;

    return {
      ...(rest as T),
      distanceKm: roundDistanceKm(meters / 1000),
    };
  });

/**
 * Guard clause for documents that predate the geo backfill.
 * A missing geoPoint simply means the record cannot participate in a nearby
 * search — it must never break the query.
 */
export const hasGeoPoint = (path: string): Record<string, any> => ({
  [`${path}.coordinates`]: { $exists: true, $ne: [] },
});
