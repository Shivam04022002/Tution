import {
  parseGeoSearchParams,
  buildGeoNearStage,
  attachDistanceKm,
} from '../services/geoSearchService';
import {
  parseRadiusKm,
  kmToMeters,
  DEFAULT_SEARCH_RADIUS_KM,
  MAX_SEARCH_RADIUS_KM,
  MIN_SEARCH_RADIUS_KM,
  SEARCH_RADIUS_OPTIONS_KM,
} from '../config/searchRadius';
import { toGeoPoint } from '../models/geoPointSync';

describe('search radius configuration', () => {
  it('exposes the documented radius options in ascending order', () => {
    expect(SEARCH_RADIUS_OPTIONS_KM).toEqual([1, 1.5, 2, 2.5, 3, 5, 10]);

    const sorted = [...SEARCH_RADIUS_OPTIONS_KM].sort((a, b) => a - b);
    expect([...SEARCH_RADIUS_OPTIONS_KM]).toEqual(sorted);
  });

  it('converts kilometres to metres for MongoDB', () => {
    expect(kmToMeters(1)).toBe(1000);
    expect(kmToMeters(1.5)).toBe(1500);
    expect(kmToMeters(2)).toBe(2000);
  });

  it('falls back to the default for missing or nonsensical radii', () => {
    expect(parseRadiusKm(undefined)).toBe(DEFAULT_SEARCH_RADIUS_KM);
    expect(parseRadiusKm('')).toBe(DEFAULT_SEARCH_RADIUS_KM);
    expect(parseRadiusKm('abc')).toBe(DEFAULT_SEARCH_RADIUS_KM);
    expect(parseRadiusKm(-5)).toBe(DEFAULT_SEARCH_RADIUS_KM);
    expect(parseRadiusKm(0)).toBe(DEFAULT_SEARCH_RADIUS_KM);
  });

  it('clamps radii to the supported bounds', () => {
    expect(parseRadiusKm(0.1)).toBe(MIN_SEARCH_RADIUS_KM);
    expect(parseRadiusKm(9999)).toBe(MAX_SEARCH_RADIUS_KM);
  });

  it('accepts the string form the API receives over the wire', () => {
    expect(parseRadiusKm('1.5')).toBe(1.5);
  });
});

describe('parseGeoSearchParams', () => {
  it('returns nothing when no location is supplied, so non-geo search still works', () => {
    expect(parseGeoSearchParams({})).toEqual({});
    expect(parseGeoSearchParams({ subjects: 'Maths' })).toEqual({});
  });

  it('rejects a half-supplied location rather than silently ignoring it', () => {
    expect(parseGeoSearchParams({ latitude: '26.8' }).error).toBeTruthy();
    expect(parseGeoSearchParams({ longitude: '80.9' }).error).toBeTruthy();
  });

  it('rejects out-of-range coordinates', () => {
    expect(parseGeoSearchParams({ latitude: '95', longitude: '80.9' }).error).toBeTruthy();
    expect(parseGeoSearchParams({ latitude: '26.8', longitude: '200' }).error).toBeTruthy();
  });

  it('rejects null island, which signals unset coordinates in this codebase', () => {
    expect(parseGeoSearchParams({ latitude: '0', longitude: '0' }).error).toBeTruthy();
  });

  it('parses a complete location and applies the default radius', () => {
    const { geo, error } = parseGeoSearchParams({ latitude: '26.8467', longitude: '80.9462' });

    expect(error).toBeUndefined();
    expect(geo).toEqual({
      latitude: 26.8467,
      longitude: 80.9462,
      radiusKm: DEFAULT_SEARCH_RADIUS_KM,
    });
  });
});

describe('buildGeoNearStage', () => {
  const geo = { latitude: 26.8467, longitude: 80.9462, radiusKm: 1.5 };

  it('emits GeoJSON coordinates as [longitude, latitude]', () => {
    const stage = buildGeoNearStage({ geo, path: 'locationAvailability.geoPoint', query: {} });

    expect(stage.$geoNear.near).toEqual({
      type: 'Point',
      coordinates: [80.9462, 26.8467],
    });
  });

  it('converts the radius to metres for maxDistance', () => {
    const stage = buildGeoNearStage({ geo, path: 'locationAvailability.geoPoint', query: {} });
    expect(stage.$geoNear.maxDistance).toBe(1500);
  });

  it('carries the existing eligibility filters into the geo query', () => {
    const query = {
      isActive: true,
      isVerified: true,
      'teachingDetails.subjects': { $in: ['Mathematics'] },
    };
    const stage = buildGeoNearStage({ geo, path: 'locationAvailability.geoPoint', query });

    expect(stage.$geoNear.query).toEqual(query);
    expect(stage.$geoNear.spherical).toBe(true);
  });
});

describe('attachDistanceKm', () => {
  it('converts metres to kilometres and drops the raw field', () => {
    const [row] = attachDistanceKm([{ _id: 'a', distanceMeters: 620 }]);

    expect(row.distanceKm).toBe(0.62);
    expect((row as any).distanceMeters).toBeUndefined();
  });

  it('rounds to two decimals', () => {
    expect(attachDistanceKm([{ distanceMeters: 1104.7 }])[0].distanceKm).toBe(1.1);
    expect(attachDistanceKm([{ distanceMeters: 1483.2 }])[0].distanceKm).toBe(1.48);
  });

  it('treats a missing distance as zero instead of NaN', () => {
    expect(attachDistanceKm([{ _id: 'a' } as any])[0].distanceKm).toBe(0);
  });
});

describe('toGeoPoint', () => {
  it('swaps latitude/longitude into GeoJSON order', () => {
    expect(toGeoPoint(26.8467, 80.9462)).toEqual({
      type: 'Point',
      coordinates: [80.9462, 26.8467],
    });
  });

  it('returns undefined for unusable coordinates so the doc stays out of the index', () => {
    expect(toGeoPoint(undefined, undefined)).toBeUndefined();
    expect(toGeoPoint(null, null)).toBeUndefined();
    expect(toGeoPoint(0, 0)).toBeUndefined();
    expect(toGeoPoint(95, 80)).toBeUndefined();
    expect(toGeoPoint(26.8, 200)).toBeUndefined();
    expect(toGeoPoint(NaN, NaN)).toBeUndefined();
    expect(toGeoPoint('26.8' as any, '80.9' as any)).toBeUndefined();
  });

  it('accepts an eastern longitude above 90, which the old legacy-pair index rejected', () => {
    // Assam, ~92.9E. Indexing { latitude, longitude } as a legacy pair read
    // 92.9 as a latitude and failed. GeoJSON handles it correctly.
    expect(toGeoPoint(26.2, 92.9)).toEqual({
      type: 'Point',
      coordinates: [92.9, 26.2],
    });
  });
});
