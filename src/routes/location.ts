import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { geocodeAddress, reverseGeocode, searchPlaces, getPlaceDetails } from '../services/geocodingService';
import { validateLocationCoordinates, validateIndianPincode } from '../services/locationService';
import { haversineDistance } from '../services/distanceService';

const router = Router();

router.get('/geocode', authenticate, async (req: Request, res: Response) => {
  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ success: false, message: 'address query param is required' });
  }

  const result = await geocodeAddress(address);
  if (!result) {
    return res.status(404).json({ success: false, message: 'Location not found' });
  }

  return res.json({ success: true, data: result });
});

router.get('/reverse-geocode', authenticate, async (req: Request, res: Response) => {
  const { lat, lng } = req.query;

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lng as string);

  const validation = validateLocationCoordinates(latitude, longitude);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.errors.join(', ') });
  }

  const result = await reverseGeocode(latitude, longitude);
  if (!result) {
    return res.status(404).json({ success: false, message: 'Address not found for coordinates' });
  }

  return res.json({ success: true, data: result });
});

router.get('/places/search', authenticate, async (req: Request, res: Response) => {
  const { query, lat, lng } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ success: false, message: 'query param is required' });
  }

  const latitude = lat ? parseFloat(lat as string) : undefined;
  const longitude = lng ? parseFloat(lng as string) : undefined;

  const suggestions = await searchPlaces(query, latitude, longitude);
  return res.json({ success: true, data: suggestions });
});

router.get('/places/details', authenticate, async (req: Request, res: Response) => {
  const { placeId } = req.query;

  if (!placeId || typeof placeId !== 'string') {
    return res.status(400).json({ success: false, message: 'placeId query param is required' });
  }

  const details = await getPlaceDetails(placeId);
  if (!details) {
    return res.status(404).json({ success: false, message: 'Place details not found' });
  }

  return res.json({ success: true, data: details });
});

router.get('/distance', authenticate, (req: Request, res: Response) => {
  const { lat1, lng1, lat2, lng2 } = req.query;

  const fromLat = parseFloat(lat1 as string);
  const fromLng = parseFloat(lng1 as string);
  const toLat = parseFloat(lat2 as string);
  const toLng = parseFloat(lng2 as string);

  const v1 = validateLocationCoordinates(fromLat, fromLng);
  const v2 = validateLocationCoordinates(toLat, toLng);

  if (!v1.valid || !v2.valid) {
    return res.status(400).json({
      success: false,
      message: [...v1.errors, ...v2.errors].join(', '),
    });
  }

  const distanceKm = haversineDistance(
    { latitude: fromLat, longitude: fromLng },
    { latitude: toLat, longitude: toLng }
  );

  return res.json({
    success: true,
    data: {
      distanceKm: Math.round(distanceKm * 10) / 10,
      distanceMiles: Math.round(distanceKm * 0.621371 * 10) / 10,
    },
  });
});

export default router;
