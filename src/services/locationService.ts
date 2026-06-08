import { haversineDistance, filterWithinRadius } from './distanceService';
import { geocodeAddress, reverseGeocode } from './geocodingService';

export interface LocationPoint {
  latitude: number;
  longitude: number;
}

export interface RequirementLocation {
  address: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
  teachingRadius: number;
}

export interface TeacherPreferredLocation {
  area: string;
  city: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export interface LocationValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLocationCoordinates(lat: number, lng: number): LocationValidationResult {
  const errors: string[] = [];

  if (typeof lat !== 'number' || isNaN(lat)) {
    errors.push('Latitude must be a valid number');
  } else if (lat < -90 || lat > 90) {
    errors.push('Latitude must be between -90 and 90');
  }

  if (typeof lng !== 'number' || isNaN(lng)) {
    errors.push('Longitude must be a valid number');
  } else if (lng < -180 || lng > 180) {
    errors.push('Longitude must be between -180 and 180');
  }

  // Reject 0,0 (null island) as it indicates unset coordinates
  if (lat === 0 && lng === 0) {
    errors.push('Coordinates (0, 0) are not a valid location');
  }

  return { valid: errors.length === 0, errors };
}

export function validateIndianPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode);
}

export function validateRequirementLocation(loc: Partial<RequirementLocation>): LocationValidationResult {
  const errors: string[] = [];

  if (!loc.address || loc.address.trim().length < 5) {
    errors.push('Address must be at least 5 characters');
  }
  if (!loc.city || loc.city.trim().length < 2) {
    errors.push('City is required');
  }
  if (!loc.pincode || !validateIndianPincode(loc.pincode)) {
    errors.push('Pincode must be a valid 6-digit Indian pincode');
  }
  if (loc.latitude !== undefined && loc.longitude !== undefined) {
    const coordCheck = validateLocationCoordinates(loc.latitude, loc.longitude);
    if (!coordCheck.valid) errors.push(...coordCheck.errors);
  }
  if (loc.teachingRadius !== undefined && (loc.teachingRadius < 1 || loc.teachingRadius > 50)) {
    errors.push('Teaching radius must be between 1 and 50 km');
  }

  return { valid: errors.length === 0, errors };
}

export function validateTeacherPreferredLocation(
  loc: Partial<TeacherPreferredLocation>
): LocationValidationResult {
  const errors: string[] = [];

  if (!loc.area || loc.area.trim().length < 2) {
    errors.push('Area name is required');
  }
  if (!loc.city || loc.city.trim().length < 2) {
    errors.push('City is required');
  }
  if (loc.latitude !== undefined && loc.longitude !== undefined) {
    const coordCheck = validateLocationCoordinates(loc.latitude, loc.longitude);
    if (!coordCheck.valid) errors.push(...coordCheck.errors);
  }
  if (loc.radiusKm !== undefined && (loc.radiusKm < 1 || loc.radiusKm > 50)) {
    errors.push('Radius must be between 1 and 50 km');
  }

  return { valid: errors.length === 0, errors };
}

export async function enrichLocationWithCoordinates(
  address: string,
  city: string,
  pincode: string
): Promise<{ latitude: number; longitude: number } | null> {
  const fullAddress = [address, city, pincode, 'India'].filter(Boolean).join(', ');
  const result = await geocodeAddress(fullAddress);
  if (!result) return null;
  return { latitude: result.latitude, longitude: result.longitude };
}

export async function enrichCoordinatesWithAddress(
  latitude: number,
  longitude: number
): Promise<{ city: string; pincode: string; formattedAddress: string } | null> {
  const result = await reverseGeocode(latitude, longitude);
  if (!result) return null;
  return {
    city: result.city,
    pincode: result.pincode,
    formattedAddress: result.formattedAddress,
  };
}

export function findTeachersWithinRequirementRadius(
  requirementLocation: { latitude: number; longitude: number; teachingRadius: number },
  teacherLocations: Array<{ latitude: number; longitude: number; teacherId: string }>
): Array<{ teacherId: string; distanceKm: number }> {
  return filterWithinRadius(
    { latitude: requirementLocation.latitude, longitude: requirementLocation.longitude },
    teacherLocations.map(t => ({ ...t })),
    requirementLocation.teachingRadius
  ).map(t => ({ teacherId: t.teacherId, distanceKm: t.distanceKm }));
}

export function doesTeacherServeLocation(
  preferredLocations: TeacherPreferredLocation[],
  targetLocation: LocationPoint
): { serves: boolean; matchedArea?: TeacherPreferredLocation; distanceKm?: number } {
  for (const pref of preferredLocations) {
    const distance = haversineDistance(
      { latitude: pref.latitude, longitude: pref.longitude },
      targetLocation
    );
    if (distance <= pref.radiusKm) {
      return {
        serves: true,
        matchedArea: pref,
        distanceKm: Math.round(distance * 10) / 10,
      };
    }
  }
  return { serves: false };
}

export function buildMongoNearQuery(
  latitude: number,
  longitude: number,
  maxDistanceMeters: number = 10000
): object {
  return {
    $near: {
      $geometry: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      $maxDistance: maxDistanceMeters,
    },
  };
}

export function buildMongoGeoWithinQuery(
  latitude: number,
  longitude: number,
  radiusKm: number
): object {
  const radiusRadians = radiusKm / 6371;
  return {
    $geoWithin: {
      $centerSphere: [[longitude, latitude], radiusRadians],
    },
  };
}
