import { Location } from "./resource-allocator.interface";

/**
 * Result returned by a DistanceProvider.
 */
export interface DistanceMatrixResult {
  distanceKm: number;
  durationMinutes: number;
  trafficDelayMinutes: number;
}

/**
 * Interface for the DistanceProvider to fetch real or mock route estimations.
 */
export interface IDistanceProvider {
  getDistanceAndDuration(origin: Location, destination: Location): Promise<DistanceMatrixResult>;
}

/**
 * Route details for optimized resources.
 */
export interface RouteDetails extends DistanceMatrixResult {
  estimatedArrivalTime: string;
  dispatchTime: string;
  routeStatus: "Optimal" | "Delayed" | "CriticalDelay";
}
