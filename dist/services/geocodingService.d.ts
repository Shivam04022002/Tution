export interface GeocodingResult {
    latitude: number;
    longitude: number;
    formattedAddress: string;
    city: string;
    pincode: string;
    state: string;
    country: string;
}
export interface ReverseGeocodingResult {
    formattedAddress: string;
    city: string;
    pincode: string;
    state: string;
    country: string;
    neighborhood?: string;
}
export declare function geocodeAddress(address: string): Promise<GeocodingResult | null>;
export declare function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult | null>;
export declare function geocodePincode(pincode: string): Promise<GeocodingResult | null>;
export declare function searchPlaces(query: string, latitude?: number, longitude?: number): Promise<Array<{
    placeId: string;
    description: string;
    mainText: string;
    secondaryText: string;
}>>;
export declare function getPlaceDetails(placeId: string): Promise<GeocodingResult | null>;
//# sourceMappingURL=geocodingService.d.ts.map