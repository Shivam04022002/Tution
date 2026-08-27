import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/** Mean Earth radius in km — matches the spherical model MongoDB uses. */
const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/**
 * Project a point `distanceKm` away from an origin along a compass bearing.
 * Used to place fixtures at precisely known distances.
 */
export const destinationPoint = (
  latitude: number,
  longitude: number,
  distanceKm: number,
  bearingDeg = 0
): { latitude: number; longitude: number } => {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(latitude);
  const lon1 = toRad(longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { latitude: toDeg(lat2), longitude: toDeg(lon2) };
};

/** Gomti Nagar, Lucknow — the reference origin used across the geo tests. */
export const ORIGIN = { latitude: 26.8467, longitude: 80.9462 };

let memoryServer: MongoMemoryServer | null = null;

export const startTestDatabase = async (): Promise<void> => {
  // Tests create the indexes they need explicitly.
  mongoose.set('autoIndex', false);
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
};

export const stopTestDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

export const clearCollections = async (): Promise<void> => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};
