"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const geocodingService_1 = require("../services/geocodingService");
const locationService_1 = require("../services/locationService");
const distanceService_1 = require("../services/distanceService");
const router = (0, express_1.Router)();
router.get('/geocode', auth_1.authenticate, async (req, res) => {
    const { address } = req.query;
    if (!address || typeof address !== 'string') {
        return res.status(400).json({ success: false, message: 'address query param is required' });
    }
    const result = await (0, geocodingService_1.geocodeAddress)(address);
    if (!result) {
        return res.status(404).json({ success: false, message: 'Location not found' });
    }
    return res.json({ success: true, data: result });
});
router.get('/reverse-geocode', auth_1.authenticate, async (req, res) => {
    const { lat, lng } = req.query;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const validation = (0, locationService_1.validateLocationCoordinates)(latitude, longitude);
    if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.errors.join(', ') });
    }
    const result = await (0, geocodingService_1.reverseGeocode)(latitude, longitude);
    if (!result) {
        return res.status(404).json({ success: false, message: 'Address not found for coordinates' });
    }
    return res.json({ success: true, data: result });
});
router.get('/places/search', auth_1.authenticate, async (req, res) => {
    const { query, lat, lng } = req.query;
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, message: 'query param is required' });
    }
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;
    const suggestions = await (0, geocodingService_1.searchPlaces)(query, latitude, longitude);
    return res.json({ success: true, data: suggestions });
});
router.get('/places/details', auth_1.authenticate, async (req, res) => {
    const { placeId } = req.query;
    if (!placeId || typeof placeId !== 'string') {
        return res.status(400).json({ success: false, message: 'placeId query param is required' });
    }
    const details = await (0, geocodingService_1.getPlaceDetails)(placeId);
    if (!details) {
        return res.status(404).json({ success: false, message: 'Place details not found' });
    }
    return res.json({ success: true, data: details });
});
router.get('/distance', auth_1.authenticate, (req, res) => {
    const { lat1, lng1, lat2, lng2 } = req.query;
    const fromLat = parseFloat(lat1);
    const fromLng = parseFloat(lng1);
    const toLat = parseFloat(lat2);
    const toLng = parseFloat(lng2);
    const v1 = (0, locationService_1.validateLocationCoordinates)(fromLat, fromLng);
    const v2 = (0, locationService_1.validateLocationCoordinates)(toLat, toLng);
    if (!v1.valid || !v2.valid) {
        return res.status(400).json({
            success: false,
            message: [...v1.errors, ...v2.errors].join(', '),
        });
    }
    const distanceKm = (0, distanceService_1.haversineDistance)({ latitude: fromLat, longitude: fromLng }, { latitude: toLat, longitude: toLng });
    return res.json({
        success: true,
        data: {
            distanceKm: Math.round(distanceKm * 10) / 10,
            distanceMiles: Math.round(distanceKm * 0.621371 * 10) / 10,
        },
    });
});
exports.default = router;
//# sourceMappingURL=location.js.map