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
export declare function haversineDistance(from: Coordinates, to: Coordinates): number;
export declare function calculateDistance(from: Coordinates, to: Coordinates, radiusKm?: number): DistanceResult;
export declare function isWithinRadius(from: Coordinates, to: Coordinates, radiusKm: number): boolean;
export declare function formatDistance(distanceKm: number): string;
export declare function findNearestLocation(origin: Coordinates, candidates: Array<Coordinates & {
    id?: string;
}>): {
    index: number;
    distanceKm: number;
} | null;
export declare function filterWithinRadius<T extends Coordinates>(origin: Coordinates, candidates: T[], radiusKm: number): Array<T & {
    distanceKm: number;
}>;
//# sourceMappingURL=distanceService.d.ts.map