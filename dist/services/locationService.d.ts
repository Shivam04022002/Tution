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
export declare function validateLocationCoordinates(lat: number, lng: number): LocationValidationResult;
export declare function validateIndianPincode(pincode: string): boolean;
export declare function validateRequirementLocation(loc: Partial<RequirementLocation>): LocationValidationResult;
export declare function validateTeacherPreferredLocation(loc: Partial<TeacherPreferredLocation>): LocationValidationResult;
export declare function enrichLocationWithCoordinates(address: string, city: string, pincode: string): Promise<{
    latitude: number;
    longitude: number;
} | null>;
export declare function enrichCoordinatesWithAddress(latitude: number, longitude: number): Promise<{
    city: string;
    pincode: string;
    formattedAddress: string;
} | null>;
export declare function findTeachersWithinRequirementRadius(requirementLocation: {
    latitude: number;
    longitude: number;
    teachingRadius: number;
}, teacherLocations: Array<{
    latitude: number;
    longitude: number;
    teacherId: string;
}>): Array<{
    teacherId: string;
    distanceKm: number;
}>;
export declare function doesTeacherServeLocation(preferredLocations: TeacherPreferredLocation[], targetLocation: LocationPoint): {
    serves: boolean;
    matchedArea?: TeacherPreferredLocation;
    distanceKm?: number;
};
export declare function buildMongoNearQuery(latitude: number, longitude: number, maxDistanceMeters?: number): object;
export declare function buildMongoGeoWithinQuery(latitude: number, longitude: number, radiusKm: number): object;
//# sourceMappingURL=locationService.d.ts.map