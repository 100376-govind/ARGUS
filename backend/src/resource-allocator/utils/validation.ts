import { Location } from "../interfaces/resource-allocator.interface";

export class ResourceAllocatorValidator {
  /**
   * Validates latitude and longitude coordinates.
   */
  public static isValidLocation(location: Location): boolean {
    if (!location) return false;
    const { latitude, longitude } = location;
    
    if (typeof latitude !== "number" || isNaN(latitude)) return false;
    if (typeof longitude !== "number" || isNaN(longitude)) return false;

    if (latitude < -90 || latitude > 90) return false;
    if (longitude < -180 || longitude > 180) return false;

    return true;
  }

  /**
   * Ensures radius query parameter is positive.
   */
  public static isValidRadius(radiusKm: number): boolean {
    return typeof radiusKm === "number" && !isNaN(radiusKm) && radiusKm > 0;
  }
}
