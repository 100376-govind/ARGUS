import { Location } from "../interfaces/resource-allocator.interface";
import { IDistanceProvider, DistanceMatrixResult } from "../interfaces/route-optimization.interface";

/**
 * Mock provider for distance and travel time calculation when Google Maps Distance Matrix API is not configured.
 */
export class MockDistanceProvider implements IDistanceProvider {
  /**
   * Estimates distance and duration between origin and destination with mock traffic delays.
   */
  public async getDistanceAndDuration(origin: Location, destination: Location): Promise<DistanceMatrixResult> {
    const distanceKm = this.calculateHaversineDistance(origin, destination);
    
    // Average emergency vehicle speed is 50 km/h
    const averageSpeedKmh = 50;
    const baseDurationMinutes = (distanceKm / averageSpeedKmh) * 60;

    // Simulate traffic delay based on distance & random seed factors
    let trafficDelayMinutes = 0;
    if (distanceKm > 10) {
      // Larger distance implies higher likelihood of traffic bottlenecks
      trafficDelayMinutes = parseFloat((Math.sin(origin.latitude + destination.longitude) * 4 + 5).toFixed(1));
    } else {
      trafficDelayMinutes = parseFloat((Math.cos(origin.longitude - destination.latitude) * 2 + 2).toFixed(1));
    }
    
    // Ensure delay is non-negative
    trafficDelayMinutes = Math.max(0, trafficDelayMinutes);

    return {
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      durationMinutes: parseFloat(Math.max(1, baseDurationMinutes + trafficDelayMinutes).toFixed(1)),
      trafficDelayMinutes,
    };
  }

  private calculateHaversineDistance(loc1: Location, loc2: Location): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(loc2.latitude - loc1.latitude);
    const dLon = this.toRadians(loc2.longitude - loc1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(loc1.latitude)) *
        Math.cos(this.toRadians(loc2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
