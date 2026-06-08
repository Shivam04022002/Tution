"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.geocodeAddress = geocodeAddress;
exports.reverseGeocode = reverseGeocode;
exports.geocodePincode = geocodePincode;
exports.searchPlaces = searchPlaces;
exports.getPlaceDetails = getPlaceDetails;
const https_1 = __importDefault(require("https"));
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
function httpGet(url) {
    return new Promise((resolve, reject) => {
        https_1.default.get(url, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}
function extractAddressComponent(components, type, useShort = false) {
    const comp = components.find(c => c.types.includes(type));
    return comp ? (useShort ? comp.short_name : comp.long_name) : '';
}
async function geocodeAddress(address) {
    if (!GOOGLE_MAPS_API_KEY) {
        console.warn('[GeocodingService] GOOGLE_MAPS_API_KEY not set; returning null');
        return null;
    }
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_API_KEY}&region=in`;
    try {
        const body = await httpGet(url);
        const data = JSON.parse(body);
        if (data.status !== 'OK' || !data.results?.length) {
            return null;
        }
        const result = data.results[0];
        const loc = result.geometry.location;
        const components = result.address_components;
        return {
            latitude: loc.lat,
            longitude: loc.lng,
            formattedAddress: result.formatted_address,
            city: extractAddressComponent(components, 'locality') ||
                extractAddressComponent(components, 'administrative_area_level_2'),
            pincode: extractAddressComponent(components, 'postal_code'),
            state: extractAddressComponent(components, 'administrative_area_level_1'),
            country: extractAddressComponent(components, 'country'),
        };
    }
    catch (err) {
        console.error('[GeocodingService] geocodeAddress error:', err);
        return null;
    }
}
async function reverseGeocode(latitude, longitude) {
    if (!GOOGLE_MAPS_API_KEY) {
        console.warn('[GeocodingService] GOOGLE_MAPS_API_KEY not set; returning null');
        return null;
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&region=in`;
    try {
        const body = await httpGet(url);
        const data = JSON.parse(body);
        if (data.status !== 'OK' || !data.results?.length) {
            return null;
        }
        const result = data.results[0];
        const components = result.address_components;
        return {
            formattedAddress: result.formatted_address,
            city: extractAddressComponent(components, 'locality') ||
                extractAddressComponent(components, 'administrative_area_level_2'),
            pincode: extractAddressComponent(components, 'postal_code'),
            state: extractAddressComponent(components, 'administrative_area_level_1'),
            country: extractAddressComponent(components, 'country'),
            neighborhood: extractAddressComponent(components, 'sublocality_level_1') ||
                extractAddressComponent(components, 'neighborhood'),
        };
    }
    catch (err) {
        console.error('[GeocodingService] reverseGeocode error:', err);
        return null;
    }
}
async function geocodePincode(pincode) {
    return geocodeAddress(`${pincode}, India`);
}
async function searchPlaces(query, latitude, longitude) {
    if (!GOOGLE_MAPS_API_KEY)
        return [];
    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&components=country:in&types=geocode`;
    if (latitude && longitude) {
        url += `&location=${latitude},${longitude}&radius=50000`;
    }
    try {
        const body = await httpGet(url);
        const data = JSON.parse(body);
        if (data.status !== 'OK')
            return [];
        return (data.predictions || []).map((p) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting?.main_text || p.description,
            secondaryText: p.structured_formatting?.secondary_text || '',
        }));
    }
    catch (err) {
        console.error('[GeocodingService] searchPlaces error:', err);
        return [];
    }
}
async function getPlaceDetails(placeId) {
    if (!GOOGLE_MAPS_API_KEY)
        return null;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,address_component&key=${GOOGLE_MAPS_API_KEY}`;
    try {
        const body = await httpGet(url);
        const data = JSON.parse(body);
        if (data.status !== 'OK' || !data.result)
            return null;
        const result = data.result;
        const loc = result.geometry.location;
        const components = result.address_components || [];
        return {
            latitude: loc.lat,
            longitude: loc.lng,
            formattedAddress: result.formatted_address,
            city: extractAddressComponent(components, 'locality') ||
                extractAddressComponent(components, 'administrative_area_level_2'),
            pincode: extractAddressComponent(components, 'postal_code'),
            state: extractAddressComponent(components, 'administrative_area_level_1'),
            country: extractAddressComponent(components, 'country'),
        };
    }
    catch (err) {
        console.error('[GeocodingService] getPlaceDetails error:', err);
        return null;
    }
}
//# sourceMappingURL=geocodingService.js.map