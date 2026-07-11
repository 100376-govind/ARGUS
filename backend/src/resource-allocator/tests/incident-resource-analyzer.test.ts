import { describe, it, expect, beforeEach } from "vitest";
import { IncidentResourceAnalyzerService, IncidentResourceAnalysis } from "../services/incident-resource-analyzer.service";
import {
  resolveIncidentResourceMapping,
  INCIDENT_RESOURCE_MAP,
  VICTIM_QUANTITY_TIERS,
  HIGH_PRIORITY_RESOURCE_BOOST,
} from "../config/incident-resource-mapping.config";
import { ValidatedIncidentInput } from "../interfaces/resource-matching.interface";
import { AllocationBuilder } from "../services/allocation-builder.service";

// Helper to build a mock ValidatedIncidentInput
function buildMockIncident(overrides: Partial<ValidatedIncidentInput> = {}): ValidatedIncidentInput {
  return {
    incidentId: "INC-TEST-001",
    incidentType: "Fire",
    priority: "HIGH",
    validationStatus: "VALIDATED",
    validationConfidence: 92,
    location: { latitude: 22.5726, longitude: 88.3639 },
    coordinates: { latitude: 22.5726, longitude: 88.3639 },
    estimatedVictims: 5,
    ...overrides,
  };
}

describe("Incident Resource Analyzer Integration", () => {
  let analyzer: IncidentResourceAnalyzerService;

  beforeEach(() => {
    analyzer = new IncidentResourceAnalyzerService();
  });

  // =====================================================
  // TEST GROUP 1: IncidentResourceAnalyzer
  // =====================================================
  describe("IncidentResourceAnalyzerService", () => {
    it("should analyze a Fire incident and return FireTruck, Ambulance, Police", () => {
      const incident = buildMockIncident({ incidentType: "Fire", estimatedVictims: 5, priority: "HIGH" });
      const result = analyzer.analyze(incident);

      expect(result.incidentId).toBe("INC-TEST-001");
      expect(result.requiredResources).toContain("FireTruck");
      expect(result.requiredResources).toContain("Ambulance");
      expect(result.requiredResources).toContain("Police");
      expect(result.priorityLevel).toBe("HIGH");
      expect(result.victimTier).toBe("Moderate");
    });

    it("should analyze a Flood incident and return RescueBoat, Ambulance, Police", () => {
      const incident = buildMockIncident({ incidentType: "Flood", estimatedVictims: 3, priority: "CRITICAL" });
      const result = analyzer.analyze(incident);

      expect(result.requiredResources).toContain("RescueBoat");
      expect(result.requiredResources).toContain("Ambulance");
      expect(result.requiredResources).toContain("Police");
      expect(result.priorityBoostApplied).toBe(true);
    });

    it("should analyze a Medical incident and return Ambulance, Hospital", () => {
      const incident = buildMockIncident({ incidentType: "Medical", estimatedVictims: 1, priority: "LOW" });
      const result = analyzer.analyze(incident);

      expect(result.requiredResources).toEqual(["Ambulance", "Hospital"]);
      expect(result.priorityBoostApplied).toBe(false);
      expect(result.victimTier).toBe("Minor");
    });

    it("should analyze an Earthquake incident and return FireTruck, Ambulance, Police", () => {
      const incident = buildMockIncident({ incidentType: "Earthquake", estimatedVictims: 15, priority: "CRITICAL" });
      const result = analyzer.analyze(incident);

      expect(result.requiredResources).toContain("FireTruck");
      expect(result.requiredResources).toContain("Ambulance");
      expect(result.requiredResources).toContain("Police");
      expect(result.victimTier).toBe("Major");
      expect(result.priorityBoostApplied).toBe(true);
    });

    it("should analyze a Chemical Leak incident and return Hazmat resources", () => {
      const incident = buildMockIncident({ incidentType: "Chemical Leak", estimatedVictims: 8, priority: "HIGH" });
      const result = analyzer.analyze(incident);

      expect(result.requiredResources).toContain("FireTruck");
      expect(result.requiredResources).toContain("Ambulance");
      expect(result.requiredResources).toContain("Police");
      expect(result.resourceLabels["FireTruck"]).toBe("Hazmat Team / Fire Truck");
    });

    it("should analyze a Road Accident and return Ambulance, Police", () => {
      const incident = buildMockIncident({ incidentType: "Road Accident", estimatedVictims: 2, priority: "MEDIUM" });
      const result = analyzer.analyze(incident);

      expect(result.requiredResources).toEqual(["Ambulance", "Police"]);
      expect(result.priorityBoostApplied).toBe(false);
    });

    it("should fall back to generic resources for unknown incident types", () => {
      const incident = buildMockIncident({ incidentType: "Alien Invasion", estimatedVictims: 100 });
      const result = analyzer.analyze(incident);

      expect(result.requiredResources).toEqual(["Ambulance", "Police"]);
      expect(result.totalResourceCount).toBe(2);
    });
  });

  // =====================================================
  // TEST GROUP 2: Resource Mapping Configuration
  // =====================================================
  describe("Resource Mapping Configuration", () => {
    it("should resolve Fire incident mapping", () => {
      const mapping = resolveIncidentResourceMapping("Fire");
      expect(mapping).toBeDefined();
      expect(mapping!.requiredResourceTypes).toContain("FireTruck");
    });

    it("should resolve Flood incident mapping (case-insensitive)", () => {
      const mapping = resolveIncidentResourceMapping("FLOOD");
      expect(mapping).toBeDefined();
      expect(mapping!.requiredResourceTypes).toContain("RescueBoat");
    });

    it("should resolve Building Collapse mapping", () => {
      const mapping = resolveIncidentResourceMapping("Building Collapse");
      expect(mapping).toBeDefined();
      expect(mapping!.requiredResourceTypes).toContain("FireTruck");
    });

    it("should return undefined for unknown incident type", () => {
      const mapping = resolveIncidentResourceMapping("Zombie Outbreak");
      expect(mapping).toBeUndefined();
    });

    it("should have at least 10 configurable incident types", () => {
      expect(INCIDENT_RESOURCE_MAP.length).toBeGreaterThanOrEqual(10);
    });

    it("should have victim quantity tiers defined", () => {
      expect(VICTIM_QUANTITY_TIERS.length).toBeGreaterThanOrEqual(3);
      expect(VICTIM_QUANTITY_TIERS[0].maxVictims).toBe(2);
      expect(VICTIM_QUANTITY_TIERS[1].maxVictims).toBe(10);
    });
  });

  // =====================================================
  // TEST GROUP 3: Quantity Calculator
  // =====================================================
  describe("Quantity Calculator", () => {
    it("should return 1 Ambulance for victims <= 2", () => {
      const incident = buildMockIncident({ incidentType: "Fire", estimatedVictims: 1, priority: "LOW" });
      const result = analyzer.analyze(incident);

      expect(result.resourceCount["Ambulance"]).toBe(1);
    });

    it("should return 2 Ambulances for victims 3-10", () => {
      const incident = buildMockIncident({ incidentType: "Fire", estimatedVictims: 5, priority: "LOW" });
      const result = analyzer.analyze(incident);

      expect(result.resourceCount["Ambulance"]).toBe(2);
    });

    it("should return 4 Ambulances for victims > 10", () => {
      const incident = buildMockIncident({ incidentType: "Fire", estimatedVictims: 15, priority: "LOW" });
      const result = analyzer.analyze(incident);

      expect(result.resourceCount["Ambulance"]).toBe(4);
    });

    it("should apply HIGH priority boost (+1 to all resources)", () => {
      const incident = buildMockIncident({ incidentType: "Fire", estimatedVictims: 1, priority: "HIGH" });
      const result = analyzer.analyze(incident);

      // Minor tier base = 1, HIGH boost = +1
      expect(result.resourceCount["Ambulance"]).toBe(1 + HIGH_PRIORITY_RESOURCE_BOOST);
      expect(result.priorityBoostApplied).toBe(true);
    });

    it("should apply CRITICAL priority boost (+1 to all resources)", () => {
      const incident = buildMockIncident({ incidentType: "Flood", estimatedVictims: 5, priority: "CRITICAL" });
      const result = analyzer.analyze(incident);

      // Moderate tier base = 2 for Ambulance, CRITICAL boost = +1
      expect(result.resourceCount["Ambulance"]).toBe(2 + HIGH_PRIORITY_RESOURCE_BOOST);
      expect(result.priorityBoostApplied).toBe(true);
    });

    it("should NOT apply boost for LOW priority", () => {
      const incident = buildMockIncident({ incidentType: "Medical", estimatedVictims: 1, priority: "LOW" });
      const result = analyzer.analyze(incident);

      expect(result.resourceCount["Ambulance"]).toBe(1);
      expect(result.priorityBoostApplied).toBe(false);
    });

    it("should correctly calculate totalResourceCount", () => {
      const incident = buildMockIncident({ incidentType: "Fire", estimatedVictims: 5, priority: "MEDIUM" });
      const result = analyzer.analyze(incident);

      const expectedTotal = Object.values(result.resourceCount).reduce((a, b) => a + b, 0);
      expect(result.totalResourceCount).toBe(expectedTotal);
    });
  });

  // =====================================================
  // TEST GROUP 4: Allocation Integration
  // =====================================================
  describe("Allocation Builder Integration", () => {
    it("should include requiredResourceTypes in allocation output", () => {
      const builder = new AllocationBuilder();
      const incident = buildMockIncident({ incidentType: "Fire" });
      const analysis: IncidentResourceAnalysis = {
        incidentId: "INC-TEST-001",
        incidentType: "Fire",
        requiredResources: ["FireTruck", "Ambulance", "Police"],
        resourceCount: { FireTruck: 2, Ambulance: 2, Police: 2 },
        totalResourceCount: 6,
        priorityLevel: "HIGH",
        resourceLabels: { FireTruck: "Fire Truck", Ambulance: "Ambulance", Police: "Police Unit" },
        victimTier: "Moderate",
        priorityBoostApplied: true,
      };

      const result = builder.buildAllocation([], incident, analysis);

      expect(result.requiredResourceTypes).toEqual(["FireTruck", "Ambulance", "Police"]);
      expect(result.dispatchPriority).toBe("HIGH");
      expect(result.resourceRequirements).toBeDefined();
      expect(result.resourceRequirements!.victimTier).toBe("Moderate");
      expect(result.resourceRequirements!.priorityBoostApplied).toBe(true);
    });

    it("should identify missing resources when none are allocated", () => {
      const builder = new AllocationBuilder();
      const incident = buildMockIncident({ incidentType: "Flood" });
      const analysis: IncidentResourceAnalysis = {
        incidentId: "INC-TEST-001",
        incidentType: "Flood",
        requiredResources: ["RescueBoat", "Ambulance", "Police"],
        resourceCount: { RescueBoat: 1, Ambulance: 2, Police: 1 },
        totalResourceCount: 4,
        priorityLevel: "CRITICAL",
        resourceLabels: { RescueBoat: "Rescue Boat", Ambulance: "Ambulance", Police: "Police Unit" },
        victimTier: "Moderate",
        priorityBoostApplied: true,
      };

      const result = builder.buildAllocation([], incident, analysis);

      // With no ranked resources provided, all are missing
      expect(result.missingResources).toEqual(["RescueBoat", "Ambulance", "Police"]);
      expect(result.allocatedResourceTypes).toEqual([]);
    });

    it("should not include resourceRequirements when analysis is not provided", () => {
      const builder = new AllocationBuilder();
      const incident = buildMockIncident({ incidentType: "Fire" });

      const result = builder.buildAllocation([], incident);

      expect(result.resourceRequirements).toBeUndefined();
    });
  });
});
