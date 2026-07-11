import { describe, it, expect, beforeEach } from "vitest";
import { resourceAllocatorService } from "../services/resource-allocator.service";
import { resourceAllocatorController } from "../controllers/resource-allocator.controller";
import { ResourceAllocatorValidator } from "../utils/validation";
import { AllocationModel } from "../models/resource-allocator.model";

describe("Resource Allocator Foundation Tests", () => {
  beforeEach(() => {
    // Reset service state before each test
    resourceAllocatorService.resetState();
  });

  describe("Validation Utilities", () => {
    it("should accept valid geographic coordinates", () => {
      expect(ResourceAllocatorValidator.isValidLocation({ latitude: 22.55, longitude: 88.49 })).toBe(true);
      expect(ResourceAllocatorValidator.isValidLocation({ latitude: 0, longitude: 0 })).toBe(true);
    });

    it("should reject invalid geographic coordinates", () => {
      expect(ResourceAllocatorValidator.isValidLocation({ latitude: 120, longitude: 88.49 })).toBe(false);
      expect(ResourceAllocatorValidator.isValidLocation({ latitude: -91, longitude: 100 })).toBe(false);
      expect(ResourceAllocatorValidator.isValidLocation({ latitude: 45, longitude: 185 })).toBe(false);
      expect(ResourceAllocatorValidator.isValidLocation({ latitude: NaN, longitude: 88 })).toBe(false);
    });

    it("should validate positive search radiuses", () => {
      expect(ResourceAllocatorValidator.isValidRadius(10)).toBe(true);
      expect(ResourceAllocatorValidator.isValidRadius(0)).toBe(false);
      expect(ResourceAllocatorValidator.isValidRadius(-5)).toBe(false);
    });
  });

  describe("Resource Finding (Haversine Filter)", () => {
    it("should return nearby resources and exclude faraway ones", () => {
      const baseLocation = { latitude: 22.557827, longitude: 88.49682 }; // Sector-7 Command
      
      // Find resources within 5km radius
      const nearby = resourceAllocatorService.findResources(baseLocation, 5);
      expect(nearby.length).toBeGreaterThan(0);
      
      // Faraway check with 0.1km radius (most resources should be further offset than 100m)
      const superClose = resourceAllocatorService.findResources(baseLocation, 0.1);
      expect(superClose.length).toBeLessThan(nearby.length);
    });

    it("should filter by resource types when requested", () => {
      const baseLocation = { latitude: 22.557827, longitude: 88.49682 };
      const policeUnits = resourceAllocatorService.findResources(baseLocation, 50, ["Police"]);
      
      policeUnits.forEach((res) => {
        expect(res.type).toBe("Police");
      });
    });

    it("should only find resources with status Available", () => {
      const baseLocation = { latitude: 22.557827, longitude: 88.49682 };
      const results = resourceAllocatorService.findResources(baseLocation, 50);

      results.forEach((res) => {
        expect(res.status).toBe("Available");
      });
    });
  });

  describe("ETA Calculations", () => {
    it("should calculate correct distance and compute ETA based on speed", () => {
      const loc1 = { latitude: 22.557827, longitude: 88.49682 };
      const loc2 = { latitude: 22.567827, longitude: 88.50682 }; // ~1.5 km offset

      const eta = resourceAllocatorService.calculateETA(loc1, loc2);
      expect(eta.distanceKm).toBeGreaterThan(0);
      expect(eta.estimatedTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Resource Matching & Scoring", () => {
    it("should rank resources that match incident characteristics higher", () => {
      const incident = {
        id: "INC-99",
        type: "Structural Fire",
        severity: "HIGH" as const,
        location: { latitude: 22.557827, longitude: 88.49682 },
      };

      const available = resourceAllocatorService.findResources(incident.location, 50);
      const matches = resourceAllocatorService.matchResources(incident, available);

      expect(matches.length).toBeGreaterThan(0);
      // The first matched resource should be a FireTruck because of Specialty Priority match
      expect(matches[0].resource.type).toBe("FireTruck");
      expect(matches[0].score).toBeGreaterThan(80);
    });
  });

  describe("Resource Reservations", () => {
    it("should change resource status to Reserved when reserved successfully", () => {
      const availableResources = resourceAllocatorService.getAllResources().filter(r => r.status === "Available");
      const targetId = availableResources[0].id;

      resourceAllocatorService.reserveResources([targetId]);
      
      const updatedResource = resourceAllocatorService.getAllResources().find(r => r.id === targetId);
      expect(updatedResource?.status).toBe("Reserved");
    });

    it("should throw error if attempting to reserve unavailable resource", () => {
      const offlineResource = resourceAllocatorService.getAllResources().find(r => r.status !== "Available");
      if (offlineResource) {
        expect(() => {
          resourceAllocatorService.reserveResources([offlineResource.id]);
        }).toThrow();
      }
    });
  });

  describe("Coordinated Resource Allocation (Controller)", () => {
    it("should reserve resources and generate a persisted allocation record", () => {
      const available = resourceAllocatorService.getAllResources().filter(r => r.status === "Available");
      const targetIds = [available[0].id, available[1].id];

      const allocation = resourceAllocatorController.allocateResources({
        incidentId: "INC-TEST-100",
        resourceIds: targetIds,
      });

      expect(allocation.id).toContain("ALLOC-");
      expect(allocation.incidentId).toBe("INC-TEST-100");
      expect(allocation.status).toBe("Pending");
      expect(allocation.resourceIds).toEqual(targetIds);

      // Verify resources have been successfully marked Reserved
      targetIds.forEach((id) => {
        const res = resourceAllocatorService.getAllResources().find((r) => r.id === id);
        expect(res?.status).toBe("Reserved");
      });
    });
  });

  describe("Allocation Model Transitions", () => {
    it("should allow valid state transitions", () => {
      const model = new AllocationModel({
        id: "ALLOC-001",
        incidentId: "INC-001",
        resourceIds: ["R1"],
        status: "Pending",
        etaMap: { R1: { estimatedTimeMinutes: 5, distanceKm: 2 } },
      });

      // Pending -> Confirmed
      model.updateStatus("Confirmed");
      expect(model.status).toBe("Confirmed");

      // Confirmed -> Completed
      model.updateStatus("Completed");
      expect(model.status).toBe("Completed");
    });

    it("should throw error on invalid state transitions", () => {
      const model = new AllocationModel({
        id: "ALLOC-001",
        incidentId: "INC-001",
        resourceIds: ["R1"],
        status: "Pending",
        etaMap: { R1: { estimatedTimeMinutes: 5, distanceKm: 2 } },
      });

      // Pending -> Completed (Invalid, must confirm first)
      expect(() => {
        model.updateStatus("Completed");
      }).toThrow();
    });
  });
});
