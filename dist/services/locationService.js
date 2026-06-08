"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLocationCoordinates = validateLocationCoordinates;
exports.validateIndianPincode = validateIndianPincode;
exports.validateRequirementLocation = validateRequirementLocation;
exports.validateTeacherPreferredLocation = validateTeacherPreferredLocation;
exports.enrichLocationWithCoordinates = enrichLocationWithCoordinates;
exports.enrichCoordinatesWithAddress = enrichCoordinatesWithAddress;
exports.findTeachersWithinRequirementRadius = findTeachersWithinRequirementRadius;
exports.doesTeacherServeLocation = doesTeacherServeLocation;
exports.buildMongoNearQuery = buildMongoNearQuery;
exports.buildMongoGeoWithinQuery = buildMongoGeoWithinQuery;
const distanceService_1 = require("./distanceService");
const geocodingService_1 = require("./geocodingService");
function validateLocationCoordinates(lat, lng) {
    const errors = [];
    if (typeof lat !== 'number' || isNaN(lat)) {
        errors.push('Latitude must be a valid number');
    }
    else if (lat < -90 || lat > 90) {
        errors.push('Latitude must be between -90 and 90');
    }
    if (typeof lng !== 'number' || isNaN(lng)) {
        errors.push('Longitude must be a valid number');
    }
    else if (lng < -180 || lng > 180) {
        errors.push('Longitude must be between -180 and 180');
    }
    if (lat === 0 && lng === 0) {
        errors.push('Coordinates (0, 0) are not a valid location');
    }
    return { valid: errors.length === 0, errors };
}
function validateIndianPincode(pincode) {
    return /^[1-9][0-9]{5}$/.test(pincode);
}
function validateRequirementLocation(loc) {
    const errors = [];
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
        if (!coordCheck.valid)
            errors.push(...coordCheck.errors);
    }
    if (loc.teachingRadius !== undefined && (loc.teachingRadius < 1 || loc.teachingRadius > 50)) {
        errors.push('Teaching radius must be between 1 and 50 km');
    }
    return { valid: errors.length === 0, errors };
}
function validateTeacherPreferredLocation(loc) {
    const errors = [];
    if (!loc.area || loc.area.trim().length < 2) {
        errors.push('Area name is required');
    }
    if (!loc.city || loc.city.trim().length < 2) {
        errors.push('City is required');
    }
    if (loc.latitude !== undefined && loc.longitude !== undefined) {
        const coordCheck = validateLocationCoordinates(loc.latitude, loc.longitude);
        if (!coordCheck.valid)
            errors.push(...coordCheck.errors);
    }
    if (loc.radiusKm !== undefined && (loc.radiusKm < 1 || loc.radiusKm > 50)) {
        errors.push('Radius must be between 1 and 50 km');
    }
    return { valid: errors.length === 0, errors };
}
async function enrichLocationWithCoordinates(address, city, pincode) {
    const fullAddress = [address, city, pincode, 'India'].filter(Boolean).join(', ');
    const result = await (0, geocodingService_1.geocodeAddress)(fullAddress);
    if (!result)
        return null;
    return { latitude: result.latitude, longitude: result.longitude };
}
async function enrichCoordinatesWithAddress(latitude, longitude) {
    const result = await (0, geocodingService_1.reverseGeocode)(latitude, longitude);
    if (!result)
        return null;
    return {
        city: result.city,
        pincode: result.pincode,
        formattedAddress: result.formattedAddress,
    };
}
function findTeachersWithinRequirementRadius(requirementLocation, teacherLocations) {
    return (0, distanceService_1.filterWithinRadius)({ latitude: requirementLocation.latitude, longitude: requirementLocation.longitude }, teacherLocations.map(t => ({ ...t })), requirementLocation.teachingRadius).map(t => ({ teacherId: t.teacherId, distanceKm: t.distanceKm }));
}
function doesTeacherServeLocation(preferredLocations, targetLocation) {
    for (const pref of preferredLocations) {
        const distance = (0, distanceService_1.haversineDistance)({ latitude: pref.latitude, longitude: pref.longitude }, targetLocation);
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
function buildMongoNearQuery(latitude, longitude, maxDistanceMeters = 10000) {
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
function buildMongoGeoWithinQuery(latitude, longitude, radiusKm) {
    const radiusRadians = radiusKm / 6371;
    return {
        $geoWithin: {
            $centerSphere: [[longitude, latitude], radiusRadians],
        },
    };
}
//# sourceMappingURL=locationService.js.map