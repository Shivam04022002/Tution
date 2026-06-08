"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineDistance = haversineDistance;
exports.calculateDistance = calculateDistance;
exports.isWithinRadius = isWithinRadius;
exports.formatDistance = formatDistance;
exports.findNearestLocation = findNearestLocation;
exports.filterWithinRadius = filterWithinRadius;
const EARTH_RADIUS_KM = 6371;
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}
function haversineDistance(from, to) {
    const dLat = toRadians(to.latitude - from.latitude);
    const dLon = toRadians(to.longitude - from.longitude);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(from.latitude)) *
            Math.cos(toRadians(to.latitude)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}
function calculateDistance(from, to, radiusKm = 10) {
    const distanceKm = haversineDistance(from, to);
    return {
        distanceKm: Math.round(distanceKm * 10) / 10,
        distanceMiles: Math.round(distanceKm * 0.621371 * 10) / 10,
        isWithinRadius: distanceKm <= radiusKm,
        durationEstimateMinutes: Math.round((distanceKm / 20) * 60),
    };
}
function isWithinRadius(from, to, radiusKm) {
    return haversineDistance(from, to) <= radiusKm;
}
function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
}
function findNearestLocation(origin, candidates) {
    if (!candidates.length)
        return null;
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
function filterWithinRadius(origin, candidates, radiusKm) {
    return candidates
        .map(c => ({ ...c, distanceKm: Math.round(haversineDistance(origin, c) * 10) / 10 }))
        .filter(c => c.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
}
//# sourceMappingURL=distanceService.js.map