import { Location, Resource } from "../interfaces/resource-allocator.interface";
import { EnrichedResource, RankedResource, ValidatedIncidentInput } from "../interfaces/resource-matching.interface";
import { IDistanceProvider, RouteDetails } from "../interfaces/route-optimization.interface";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";

/**
 * RouteOptimizationService selects the nearest resources, estimates travel times,
 * and recommends the optimal dispatch order.
 */
export class RouteOptimizationService {
  private readonly logger = new ResourceMatchingLogger("RouteOptimizationService");

  constructor(private readonly distanceProvider: IDistanceProvider) {}

  /**
   * Sorts resources based on Availability, Distance, Capability Score, and Priority Weight.
   * Returns top 5 resources.
   */
  public findNearestResources(
    rankedResources: RankedResource[]
  ): RankedResource[] {
    this.logger.info("Selecting nearest optimal resources");
    
    // Ranked resources are already filtered for Availability. We sort them primarily by distance,
    // capability score, and priority weight.
    const sorted = [...rankedResources].sort((a, b) => {
      // 1. Distance ascending (lower distance is better)
      if (a.eta.distanceKm !== b.eta.distanceKm) {
        return a.eta.distanceKm - b.eta.distanceKm;
      }
      // 2. Capability score descending (higher capability is better)
      if (b.capabilityScore !== a.capabilityScore) {
        return b.capabilityScore - a.capabilityScore;
      }
      // 3. Composite rank descending
      return b.compositeRank - a.compositeRank;
    });

    const top5 = sorted.slice(0, 5);
    this.logger.info(`Nearest resource selection completed: ${top5.length} selected`);
    return top5;
  }

  /**
   * Calculates distance between origin and destination coordinates.
   */
  public async calculateDistance(origin: Location, destination: Location): Promise<number> {
    const res = await this.distanceProvider.getDistanceAndDuration(origin, destination);
    return res.distanceKm;
  }

  /**
   * Estimates Travel Time, Arrival Time, Dispatch Time, Traffic Delay, and Route Status.
   */
  public async calculateETA(origin: Location, destination: Location, prepTimeMinutes: number = 2): Promise<RouteDetails> {
    const res = await this.distanceProvider.getDistanceAndDuration(origin, destination);
    
    const now = new Date();
    // Dispatch is assumed to happen after a small preparation delay
    const dispatchTime = new Date(now.getTime() + prepTimeMinutes * 60 * 1000);
    const arrivalTime = new Date(dispatchTime.getTime() + res.durationMinutes * 60 * 1000);

    let routeStatus: RouteDetails["routeStatus"] = "Optimal";
    if (res.trafficDelayMinutes > 8) {
      routeStatus = "CriticalDelay";
    } else if (res.trafficDelayMinutes > 3) {
      routeStatus = "Delayed";
    }

    return {
      distanceKm: res.distanceKm,
      durationMinutes: res.durationMinutes,
      trafficDelayMinutes: res.trafficDelayMinutes,
      dispatchTime: dispatchTime.toISOString(),
      estimatedArrivalTime: arrivalTime.toISOString(),
      routeStatus,
    };
  }

  /**
   * Recommends optimal dispatch order prioritizing resources that arrive earliest.
   */
  public async optimizeDispatchOrder(
    resources: RankedResource[],
    destination: Location
  ): Promise<Array<RankedResource & { route: RouteDetails }>> {
    this.logger.info("Optimizing dispatch order based on route profiles");
    const optimizedList = await Promise.all(
      resources.map(async (item) => {
        const route = await this.calculateETA(item.resource.location, destination);
        return {
          ...item,
          route,
        };
      })
    );

    // Sort by durationMinutes ascending (earliest arrivals first)
    optimizedList.sort((a, b) => a.route.durationMinutes - b.route.durationMinutes);

    return optimizedList;
  }
}
