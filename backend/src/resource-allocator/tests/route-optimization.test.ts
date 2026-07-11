import { describe, it, expect, beforeEach } from "vitest";
import { MockDistanceProvider } from "../services/mock-distance-provider.service";
import { RouteOptimizationService } from "../services/route-optimization.service";
import { DispatchPlanner } from "../services/dispatch-planner.service";
import { RankedResource, ResourceAllocationResult, ValidatedIncidentInput } from "../interfaces/resource-matching.interface";

describe("Route Optimization & ETA Engine Tests", () => {
  let distanceProvider: MockDistanceProvider;
  let routeService: RouteOptimizationService;
  let planner: DispatchPlanner;

  beforeEach(() => {
    distanceProvider = new MockDistanceProvider();
    routeService = new RouteOptimizationService(distanceProvider);
    planner = new DispatchPlanner(routeService);
  });

  const baseIncident: ValidatedIncidentInput = {
    incidentId: "INC-99",
    incidentType: "Fire",
    priority: "HIGH",
    validationStatus: "VALIDATED",
    validationConfidence: 100,
    location: { latitude: 22.557827, longitude: 88.49682 },
    coordinates: { latitude: 22.557827, longitude: 88.49682 },
    estimatedVictims: 5,
  };

  const mockRankedResources: RankedResource[] = [
    {
      resource: {
        id: "RES-1",
        name: "Resource 1",
        type: "FireTruck",
        status: "Available",
        location: { latitude: 22.56, longitude: 88.50 },
      },
      capabilityScore: 80,
      availabilityWeight: 100,
      distancePlaceholder: 90,
      priorityWeight: 80,
      compositeRank: 85,
      eta: { estimatedTimeMinutes: 5, distanceKm: 1.5 },
    },
    {
      resource: {
        id: "RES-2",
        name: "Resource 2",
        type: "Ambulance",
        status: "Available",
        location: { latitude: 22.60, longitude: 88.55 },
      },
      capabilityScore: 70,
      availabilityWeight: 100,
      distancePlaceholder: 70,
      priorityWeight: 80,
      compositeRank: 75,
      eta: { estimatedTimeMinutes: 15, distanceKm: 6.8 },
    },
    {
      resource: {
        id: "RES-3",
        name: "Resource 3",
        type: "Police",
        status: "Available",
        location: { latitude: 22.52, longitude: 88.45 },
      },
      capabilityScore: 90,
      availabilityWeight: 100,
      distancePlaceholder: 60,
      priorityWeight: 80,
      compositeRank: 80,
      eta: { estimatedTimeMinutes: 20, distanceKm: 8.5 },
    },
  ];

  describe("Distance Provider", () => {
    it("should return valid distance, duration and traffic delays", async () => {
      const origin = { latitude: 22.55, longitude: 88.49 };
      const destination = { latitude: 22.56, longitude: 88.50 };

      const res = await distanceProvider.getDistanceAndDuration(origin, destination);
      expect(res.distanceKm).toBeGreaterThan(0);
      expect(res.durationMinutes).toBeGreaterThan(0);
      expect(res.trafficDelayMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  describe("ETA Engine", () => {
    it("should calculate travel times and route status correctly", async () => {
      const origin = { latitude: 22.55, longitude: 88.49 };
      const destination = { latitude: 22.56, longitude: 88.50 };

      const details = await routeService.calculateETA(origin, destination);
      expect(details.distanceKm).toBeGreaterThan(0);
      expect(details.durationMinutes).toBeGreaterThan(0);
      expect(details.dispatchTime).toBeDefined();
      expect(details.estimatedArrivalTime).toBeDefined();
      expect(["Optimal", "Delayed", "CriticalDelay"]).toContain(details.routeStatus);
    });
  });

  describe("Nearest Resource Selection", () => {
    it("should correctly select and sort top resources by distance", () => {
      const nearest = routeService.findNearestResources(mockRankedResources);
      expect(nearest.length).toBeLessThanOrEqual(5);
      
      // Ensure it sorted primarily by distance (closest first)
      expect(nearest[0].resource.id).toBe("RES-1");
    });
  });

  describe("Dispatch Planner", () => {
    it("should build a prioritized dispatch order list", async () => {
      const allocation: ResourceAllocationResult = {
        allocationId: "ALLOC-100",
        incidentId: baseIncident.incidentId,
        incidentType: baseIncident.incidentType,
        priority: baseIncident.priority,
        allocatedResources: mockRankedResources,
        primaryTeam: {
          teamId: "TEAM-1",
          teamRole: "Primary",
          members: mockRankedResources,
          totalCapabilityScore: 80,
        },
        backupTeam: {
          teamId: "TEAM-2",
          teamRole: "Backup",
          members: [],
          totalCapabilityScore: 0,
        },
        hospitals: [],
        shelters: [],
        estimatedCapacity: {
          totalResponders: 6,
          totalVehicles: 3,
          medicalUnits: 1,
          rescueUnits: 1,
          hospitalBeds: 0,
          shelterSpaces: 0,
        },
        resourceScore: 82.5,
        allocationTimestamp: new Date().toISOString(),
      };

      const plan = await planner.generatePlan(allocation, baseIncident);
      expect(plan.dispatchPlanId).toContain("PLAN-DISP-");
      expect(plan.dispatchOrder.length).toBe(3);
      expect(plan.dispatchOrder[0].dispatchSequenceOrder).toBe(1);
      expect(plan.estimatedArrival).toBeDefined();
    });
  });
});
