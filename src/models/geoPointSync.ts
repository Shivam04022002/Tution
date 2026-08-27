import { Schema } from 'mongoose';

/**
 * Mongoose plugin that keeps a GeoJSON `geoPoint` in sync with an existing
 * `{ latitude, longitude }` field.
 *
 * Why this exists: MongoDB's 2dsphere index cannot correctly index an embedded
 * document like `{ latitude, longitude }` — it is read as a legacy coordinate
 * pair by FIELD ORDER, which silently swaps latitude and longitude and rejects
 * any longitude above 90. `geoPoint` is therefore a derived index projection,
 * not a second source of truth: `coordinates` stays canonical and every writer
 * in the codebase keeps working unchanged.
 */

export interface GeoPointSyncOptions {
  /** Path of the existing `{ latitude, longitude }` object. */
  sourcePath: string;
  /** Path of the derived GeoJSON point. */
  targetPath: string;
}

const getAtPath = (doc: any, path: string): any =>
  path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), doc);

const isUsableCoordinate = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180 &&
  // (0,0) is the conventional "unset" marker across this codebase.
  !(lat === 0 && lng === 0);

/**
 * Build the GeoJSON point for a lat/lng pair, or `undefined` when the pair is
 * unusable. Returning undefined leaves the document out of the 2dsphere index
 * entirely, which is exactly what we want for records with no real location.
 */
export const toGeoPoint = (
  latitude: unknown,
  longitude: unknown
): { type: 'Point'; coordinates: [number, number] } | undefined => {
  if (!isUsableCoordinate(latitude, longitude)) return undefined;

  // GeoJSON order is [longitude, latitude].
  return { type: 'Point', coordinates: [longitude as number, latitude as number] };
};

export function geoPointSync(schema: Schema, options: GeoPointSyncOptions): void {
  const { sourcePath, targetPath } = options;

  // Async hooks avoid the `next` callback entirely, which keeps the Mongoose
  // overload resolution unambiguous.
  schema.pre('save', async function (this: any) {
    // Only recompute when the source actually changed, so untouched documents
    // are not rewritten on every save.
    if (!this.isNew && !this.isModified(sourcePath)) return;

    const source = getAtPath(this, sourcePath);
    const point = toGeoPoint(source?.latitude, source?.longitude);

    this.set(targetPath, point ?? undefined);
  });

  // Mirror the same behaviour for atomic updates, which bypass `save`.
  const updateHooks = ['findOneAndUpdate', 'updateOne', 'updateMany'] as const;

  schema.pre(updateHooks as any, async function (this: any) {
    const update = this.getUpdate();
    if (!update || Array.isArray(update)) return;

    const set = update.$set ?? update;

    // Coordinates may arrive as a whole object or as dotted leaf paths.
    const whole = getAtPath(set, sourcePath) ?? set[sourcePath];
    const latitude = whole?.latitude ?? set[`${sourcePath}.latitude`];
    const longitude = whole?.longitude ?? set[`${sourcePath}.longitude`];

    if (latitude === undefined && longitude === undefined) return;

    const point = toGeoPoint(latitude, longitude);
    this.set(targetPath, point ?? undefined);
  });
}
