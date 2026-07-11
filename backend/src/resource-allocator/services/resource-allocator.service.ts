import { Location, Resource, ResourceType, ETA, AllocationStatus } from "../interfaces/resource-allocator.interface";
import { AllocationModel } from "../models/resource-allocator.model";
import { MockResourceGenerator } from "../utils/mock-generator";
import { ResourceAllocatorValidator } from "../utils/validation";

export class ResourceAllocatorService {
  private resources: Resource[] = [];
  private allocations: Map<string, AllocationModel> = new Map();

  constructor() {
    this.resources = MockResourceGenerator.generateMockResources();
  }

  /**
   * Resets resources to initial mock state (useful for tests).
   */
  public resetState(): void {
    this.resources = MockResourceGenerator.generateMockResources();
    this.allocations.clear();
  }

  /**
   * Returns all resources.
   */
  public getAllResources(): Resource[] {
    return this.resources;
  }

  /**
   * Finds available resources within a given radius.
   */
  public findResources(location: Location, radiusKm: number, types?: ResourceType[]): Resource[] {
    if (!ResourceAllocatorValidator.isValidLocation(location)) {
      throw new Error("Invalid location coordinates");
    }
    if (!ResourceAllocatorValidator.isValidRadius(radiusKm)) {
      throw new Error("Invalid search radius");
    }

    return this.resources.filter((res) => {
      // Filter by type if specified
      if (types && !types.includes(res.type)) {
        return false;
      }

      // Filter to only Available resources
      if (res.status !== "Available") {
        return false;
      }

      // Haversine distance filter
      const distance = this.calculateDistance(location, res.location);
      return distance <= radiusKm;
    });
  }

  /**
   * Calculates estimated time of arrival (ETA) and distance between locations.
   */
  public calculateETA(from: Location, to: Location): ETA {
    const distanceKm = this.calculateDistance(from, to);
    // Assume average response vehicle speed is 50 km/h (0.83 km per minute)
    const averageSpeedKmh = 50;
    const estimatedTimeMinutes = Math.max(1, Math.round((distanceKm / averageSpeedKmh) * 60));

    return {
      estimatedTimeMinutes,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
    };
  }

  /**
   * Match resources based on incident characteristics and geographic proximity.
   */
  public matchResources(incident: { id: string; type: string; severity: string; location: Location }, availableResources: Resource[]): any[] {
    return availableResources.map((res) => {
      const eta = this.calculateETA(incident.location, res.location);
      
      // Calculate matching compatibility score (0 - 100)
      let score = 100;

      // 1. Proximity score component (decay with distance)
      const proximityPenalty = Math.min(40, eta.distanceKm * 2);
      score -= proximityPenalty;

      // 2. Specialty matching weight component
      let isPrimaryMatch = false;
      const type = incident.type.toLowerCase();
      
      if (type.includes("fire") && res.type === "FireTruck") isPrimaryMatch = true;
      if (type.includes("accident") && (res.type === "Ambulance" || res.type === "Police")) isPrimaryMatch = true;
      if (type.includes("flood") && res.type === "RescueBoat") isPrimaryMatch = true;
      if (type.includes("collapse") && (res.type === "FireTruck" || res.type === "Ambulance")) isPrimaryMatch = true;
      if (type.includes("medical") && res.type === "Hospital") isPrimaryMatch = true;
      if (type.includes("evacuat") && res.type === "Shelter") isPrimaryMatch = true;

      if (!isPrimaryMatch) {
        score -= 30; // Significant penalty for sub-optimal matching
      }

      // Ensure boundary limits [0, 100]
      score = Math.max(10, Math.min(100, Math.round(score)));

      return {
        resource: res,
        score,
        eta,
      };
    }).sort((a, b) => b.score - a.score); // Highest score match first
  }

  /**
   * Reserves a list of resources.
   */
  public reserveResources(resourceIds: string[]): void {
    for (const id of resourceIds) {
      const resource = this.resources.find((r) => r.id === id);
      if (!resource) {
        throw new Error(`Resource ${id} not found`);
      }
      if (resource.status !== "Available") {
        throw new Error(`Resource ${id} is currently ${resource.status} and cannot be reserved`);
      }
      resource.status = "Reserved";
    }
  }

  /**
   * Generates and stores a new allocation mapping.
   */
  public generateAllocation(incidentId: string, matchedResources: Resource[]): AllocationModel {
    const resourceIds = matchedResources.map((r) => r.id);
    const etaMap: Record<string, ETA> = {};

    // For mocking/finding location, let's assume destination location is the command base
    const baseLocation = { latitude: 22.557827, longitude: 88.49682 };

    for (const res of matchedResources) {
      etaMap[res.id] = this.calculateETA(res.location, baseLocation);
    }

    const allocation = new AllocationModel({
      id: `ALLOC-${Math.floor(1000 + Math.random() * 9000)}`,
      incidentId,
      resourceIds,
      status: "Pending",
      etaMap,
    });

    this.allocations.set(allocation.id, allocation);
    return allocation;
  }

  /**
   * Returns an allocation by ID.
   */
  public getAllocation(allocationId: string): AllocationModel | null {
    return this.allocations.get(allocationId) || null;
  }

  /**
   * Helper method to calculate geodesic distance in kilometers between two coordinates.
   */
  private calculateDistance(loc1: Location, loc2: Location): number {
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

export const resourceAllocatorService = new ResourceAllocatorService();
