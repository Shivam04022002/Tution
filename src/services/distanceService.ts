export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DistanceResult {
  distanceKm: number;
  distanceMiles: number;
  isWithinRadius: boolean;
  durationEstimateMinutes: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function haversineDistance(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function calculateDistance(
  from: Coordinates,
  to: Coordinates,
  radiusKm: number = 10
): DistanceResult {
  const distanceKm = haversineDistance(from, to);

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    distanceMiles: Math.round(distanceKm * 0.621371 * 10) / 10,
    isWithinRadius: distanceKm <= radiusKm,
    durationEstimateMinutes: Math.round((distanceKm / 20) * 60),
  };
}

export function isWithinRadius(
  from: Coordinates,
  to: Coordinates,
  radiusKm: number
): boolean {
  return haversineDistance(from, to) <= radiusKm;
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function findNearestLocation(
  origin: Coordinates,
  candidates: Array<Coordinates & { id?: string }>
): { index: number; distanceKm: number } | null {
  if (!candidates.length) return null;

  let nearestIndex = 0;
  let nearestDistance = haversineDistance(origin, candidates[0]);

  for (let i = 1; i < candidates.length; i++) {
    const d = haversineDistance(origin, candidates[i]);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearestIndex = i;
    }
  }

  return {
    index: nearestIndex,
    distanceKm: Math.round(nearestDistance * 10) / 10,
  };
}

export function filterWithinRadius<T extends Coordinates>(
  origin: Coordinates,
  candidates: T[],
  radiusKm: number
): Array<T & { distanceKm: number }> {
  return candidates
    .map(c => ({ ...c, distanceKm: Math.round(haversineDistance(origin, c) * 10) / 10 }))
    .filter(c => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
