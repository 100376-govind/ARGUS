import { describe, it, expect, beforeEach } from "vitest";
import { AvailabilityChecker } from "../services/availability-checker.service";
import { CapabilityScorer } from "../services/capability-scorer.service";
import { ResourceRankingService } from "../services/resource-ranking.service";
import { AllocationBuilder } from "../services/allocation-builder.service";
import { Resource } from "../interfaces/resource-allocator.interface";
import {
  ValidatedIncidentInput,
  EnrichedResource,
} from "../interfaces/resource-matching.interface";
import { MockResourceGenerator } from "../utils/mock-generator";

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createMockIncident(
  overrides: Partial<ValidatedIncidentInput> = {}
): ValidatedIncidentInput {
  return {
    incidentId: "INC-TEST-001",
    incidentType: "Fire",
    priority: "HIGH",
    validationStatus: "VALIDATED",
    validationConfidence: 92,
    location: { latitude: 22.557827, longitude: 88.49682 },
    coordinates: { latitude: 22.557827, longitude: 88.49682 },
    estimatedVictims: 12,
    ...overrides,
  };
}

function createMockResource(
  overrides: Partial<Resource> = {}
): Resource {
  return {
    id: "TEST-RES-1",
    name: "Test Resource 1",
    type: "Ambulance",
    status: "Available",
    location: { latitude: 22.56, longitude: 88.50 },
    metadata: {},
    ...overrides,
  };
}

function createEnrichedResource(
  overrides: Partial<EnrichedResource> = {}
): EnrichedResource {
  return {
    id: "TEST-ENRICHED-1",
    name: "Test Enriched Resource",
    type: "Ambulance",
    status: "Available",
    location: { latitude: 22.56, longitude: 88.50 },
    metadata: {},
    responderSkill: "AdvancedParamedic",
    vehicleType: "AdvancedLifeSupport",
    medicalCapability: "AdvancedLifeSupport",
    rescueCapability: "BasicExtraction",
    ...overrides,
  };
}

// ─── AvailabilityChecker Tests ───────────────────────────────────────────────

describe("AvailabilityChecker", () => {
  let checker: AvailabilityChecker;

  beforeEach(() => {
    checker = new AvailabilityChecker();
  });

  describe("isAvailable", () => {
    it("should return true for Available resources", () => {
      const resource = createMockResource({ status: "Available" });
      expect(checker.isAvailable(resource)).toBe(true);
    });

    it("should return false for Offline resources", () => {
      const resource = createMockResource({ status: "Offline" });
      expect(checker.isAvailable(resource)).toBe(false);
    });

    it("should return false for Reserved resources", () => {
      const resource = createMockResource({ status: "Reserved" });
      expect(checker.isAvailable(resource)).toBe(false);
    });

    it("should return false for Deployed resources", () => {
      const resource = createMockResource({ status: "Deployed" });
      expect(checker.isAvailable(resource)).toBe(false);
    });
  });

  describe("isExcluded", () => {
    it("should return true for Offline status", () => {
      const resource = createMockResource({ status: "Offline" });
      expect(checker.isExcluded(resource)).toBe(true);
    });

    it("should return true for Reserved status", () => {
      const resource = createMockResource({ status: "Reserved" });
      expect(checker.isExcluded(resource)).toBe(true);
    });

    it("should return true for Deployed status", () => {
      const resource = createMockResource({ status: "Deployed" });
      expect(checker.isExcluded(resource)).toBe(true);
    });

    it("should return false for Available status", () => {
      const resource = createMockResource({ status: "Available" });
      expect(checker.isExcluded(resource)).toBe(false);
    });
  });

  describe("filterAvailable", () => {
    it("should only return Available resources from a mixed set", () => {
      const resources: Resource[] = [
        createMockResource({ id: "R1", status: "Available" }),
        createMockResource({ id: "R2", status: "Offline" }),
        createMockResource({ id: "R3", status: "Available" }),
        createMockResource({ id: "R4", status: "Reserved" }),
        createMockResource({ id: "R5", status: "Deployed" }),
      ];

      const result = checker.filterAvailable(resources);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual(["R1", "R3"]);
    });

    it("should return empty array when all resources are unavailable", () => {
      const resources: Resource[] = [
        createMockResource({ id: "R1", status: "Offline" }),
        createMockResource({ id: "R2", status: "Reserved" }),
      ];

      const result = checker.filterAvailable(resources);
      expect(result).toHaveLength(0);
    });

    it("should enrich resources with capability metadata", () => {
      const resources: Resource[] = [
        createMockResource({ id: "AMB-DEV-1", type: "Ambulance", status: "Available" }),
      ];

      const result = checker.filterAvailable(resources);
      expect(result).toHaveLength(1);
      expect(result[0].responderSkill).toBe("AdvancedParamedic");
      expect(result[0].medicalCapability).toBe("AdvancedLifeSupport");
    });

    it("should apply default enrichment for unknown resource IDs", () => {
      const resources: Resource[] = [
        createMockResource({ id: "UNKNOWN-99", status: "Available" }),
      ];

      const result = checker.filterAvailable(resources);
      expect(result).toHaveLength(1);
      expect(result[0].responderSkill).toBe("BasicFirstAid");
      expect(result[0].medicalCapability).toBe("None");
      expect(result[0].rescueCapability).toBe("None");
    });

    it("should filter real mock resources correctly", () => {
      const allResources = MockResourceGenerator.generateMockResources();
      const result = checker.filterAvailable(allResources);

      result.forEach((r) => {
        expect(r.status).toBe("Available");
      });

      expect(result.length).toBeLessThan(allResources.length);
    });
  });
});

// ─── CapabilityScorer Tests ─────────────────────────────────────────────────

describe("CapabilityScorer", () => {
  let scorer: CapabilityScorer;

  beforeEach(() => {
    scorer = new CapabilityScorer();
  });

  describe("scoreResource", () => {
    it("should return a score between 0 and 100", () => {
      const resource = createEnrichedResource();
      const incident = createMockIncident();

      const result = scorer.scoreResource(resource, incident);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
    });

    it("should provide a breakdown with all scoring dimensions", () => {
      const resource = createEnrichedResource();
      const incident = createMockIncident();

      const result = scorer.scoreResource(resource, incident);
      expect(result.breakdown).toHaveProperty("incidentTypeMatch");
      expect(result.breakdown).toHaveProperty("priorityAlignment");
      expect(result.breakdown).toHaveProperty("responderSkillScore");
      expect(result.breakdown).toHaveProperty("vehicleTypeScore");
      expect(result.breakdown).toHaveProperty("medicalCapabilityScore");
      expect(result.breakdown).toHaveProperty("rescueCapabilityScore");
    });

    it("should score FireTruck higher than Ambulance for Fire incidents", () => {
      const fireIncident = createMockIncident({ incidentType: "Structural Fire" });

      const fireTruck = createEnrichedResource({
        id: "FT-1",
        type: "FireTruck",
        responderSkill: "StructuralFirefighter",
        vehicleType: "PumperTruck",
        rescueCapability: "StructuralCollapse",
      });
      const ambulance = createEnrichedResource({
        id: "AMB-1",
        type: "Ambulance",
        responderSkill: "AdvancedParamedic",
        vehicleType: "AdvancedLifeSupport",
        rescueCapability: "BasicExtraction",
      });

      const fireScore = scorer.scoreResource(fireTruck, fireIncident);
      const ambScore = scorer.scoreResource(ambulance, fireIncident);

      expect(fireScore.totalScore).toBeGreaterThan(ambScore.totalScore);
    });

    it("should score RescueBoat higher for Flood incidents", () => {
      const floodIncident = createMockIncident({ incidentType: "Flood" });

      const rescueBoat = createEnrichedResource({
        id: "RB-1",
        type: "RescueBoat",
        responderSkill: "SwiftWaterRescue",
        vehicleType: "Motorboat",
        rescueCapability: "WaterRescue",
      });
      const police = createEnrichedResource({
        id: "POL-1",
        type: "Police",
        responderSkill: "TacticalResponse",
        vehicleType: "PatrolCar",
        rescueCapability: "BasicExtraction",
      });

      const boatScore = scorer.scoreResource(rescueBoat, floodIncident);
      const policeScore = scorer.scoreResource(police, floodIncident);

      expect(boatScore.totalScore).toBeGreaterThan(policeScore.totalScore);
    });

    it("should give higher priority alignment for CRITICAL incidents", () => {
      const resource = createEnrichedResource();

      const critical = createMockIncident({ priority: "CRITICAL" });
      const low = createMockIncident({ priority: "LOW" });

      const criticalScore = scorer.scoreResource(resource, critical);
      const lowScore = scorer.scoreResource(resource, low);

      expect(criticalScore.breakdown.priorityAlignment).toBeGreaterThan(
        lowScore.breakdown.priorityAlignment
      );
    });

    it("should increase medical score for incidents with many victims", () => {
      const resource = createEnrichedResource({
        medicalCapability: "AdvancedLifeSupport",
      });

      const manyVictims = createMockIncident({ estimatedVictims: 25 });
      const fewVictims = createMockIncident({ estimatedVictims: 3 });

      const manyResult = scorer.scoreResource(resource, manyVictims);
      const fewResult = scorer.scoreResource(resource, fewVictims);

      expect(manyResult.breakdown.medicalCapabilityScore).toBeGreaterThanOrEqual(
        fewResult.breakdown.medicalCapabilityScore
      );
    });
  });

  describe("scoreAll", () => {
    it("should return results sorted by totalScore descending", () => {
      const resources: EnrichedResource[] = [
        createEnrichedResource({ id: "R1", type: "Police", responderSkill: "TacticalResponse", vehicleType: "PatrolCar" }),
        createEnrichedResource({ id: "R2", type: "FireTruck", responderSkill: "StructuralFirefighter", vehicleType: "PumperTruck" }),
        createEnrichedResource({ id: "R3", type: "Ambulance", responderSkill: "AdvancedParamedic", vehicleType: "AdvancedLifeSupport" }),
      ];

      const incident = createMockIncident({ incidentType: "Structural Fire" });
      const results = scorer.scoreAll(resources, incident);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].totalScore).toBeGreaterThanOrEqual(results[i].totalScore);
      }
    });

    it("should score all provided resources", () => {
      const resources: EnrichedResource[] = [
        createEnrichedResource({ id: "R1" }),
        createEnrichedResource({ id: "R2" }),
        createEnrichedResource({ id: "R3" }),
      ];

      const incident = createMockIncident();
      const results = scorer.scoreAll(resources, incident);

      expect(results).toHaveLength(3);
    });
  });
});

// ─── ResourceRankingService Tests ────────────────────────────────────────────

describe("ResourceRankingService", () => {
  let rankingService: ResourceRankingService;
  let scorer: CapabilityScorer;

  beforeEach(() => {
    rankingService = new ResourceRankingService();
    scorer = new CapabilityScorer();
  });

  describe("rankResources", () => {
    it("should return resources sorted by compositeRank descending", () => {
      const resources: EnrichedResource[] = [
        createEnrichedResource({ id: "R1", type: "Police", responderSkill: "TacticalResponse", vehicleType: "PatrolCar" }),
        createEnrichedResource({ id: "R2", type: "FireTruck", responderSkill: "StructuralFirefighter", vehicleType: "PumperTruck", rescueCapability: "StructuralCollapse" }),
        createEnrichedResource({ id: "R3", type: "Ambulance" }),
      ];

      const incident = createMockIncident({ incidentType: "Fire" });
      const scores = scorer.scoreAll(resources, incident);
      const ranked = rankingService.rankResources(resources, scores, incident);

      expect(ranked.length).toBeGreaterThan(0);
      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i - 1].compositeRank).toBeGreaterThanOrEqual(
          ranked[i].compositeRank
        );
      }
    });

    it("should produce compositeRank between 0 and 100", () => {
      const resources: EnrichedResource[] = [
        createEnrichedResource({ id: "R1" }),
      ];

      const incident = createMockIncident();
      const scores = scorer.scoreAll(resources, incident);
      const ranked = rankingService.rankResources(resources, scores, incident);

      expect(ranked[0].compositeRank).toBeGreaterThanOrEqual(0);
      expect(ranked[0].compositeRank).toBeLessThanOrEqual(100);
    });

    it("should include ETA data for each ranked resource", () => {
      const resources: EnrichedResource[] = [
        createEnrichedResource({ id: "R1" }),
        createEnrichedResource({ id: "R2" }),
      ];

      const incident = createMockIncident();
      const scores = scorer.scoreAll(resources, incident);
      const ranked = rankingService.rankResources(resources, scores, incident);

      ranked.forEach((r) => {
        expect(r.eta).toBeDefined();
        expect(r.eta.estimatedTimeMinutes).toBeGreaterThanOrEqual(1);
        expect(r.eta.distanceKm).toBeGreaterThanOrEqual(0);
      });
    });

    it("should assign full availability weight to Available resources", () => {
      const resources: EnrichedResource[] = [
        createEnrichedResource({ id: "R1", status: "Available" }),
      ];

      const incident = createMockIncident();
      const scores = scorer.scoreAll(resources, incident);
      const ranked = rankingService.rankResources(resources, scores, incident);

      expect(ranked[0].availabilityWeight).toBe(100);
    });

    it("should produce higher priority weight for CRITICAL incidents", () => {
      const resource = createEnrichedResource({ id: "R1" });

      const criticalIncident = createMockIncident({ priority: "CRITICAL" });
      const lowIncident = createMockIncident({ priority: "LOW" });

      const critScores = scorer.scoreAll([resource], criticalIncident);
      const lowScores = scorer.scoreAll([resource], lowIncident);

      const critRanked = rankingService.rankResources([resource], critScores, criticalIncident);
      const lowRanked = rankingService.rankResources([resource], lowScores, lowIncident);

      expect(critRanked[0].priorityWeight).toBeGreaterThan(lowRanked[0].priorityWeight);
    });
  });
});

// ─── AllocationBuilder Tests ─────────────────────────────────────────────────

describe("AllocationBuilder", () => {
  let builder: AllocationBuilder;
  let scorer: CapabilityScorer;
  let rankingService: ResourceRankingService;

  beforeEach(() => {
    builder = new AllocationBuilder();
    scorer = new CapabilityScorer();
    rankingService = new ResourceRankingService();
  });

  function buildRankedResources(incident: ValidatedIncidentInput) {
    const resources: EnrichedResource[] = [
      createEnrichedResource({
        id: "FIRE-1", name: "Fire Engine 1", type: "FireTruck",
        responderSkill: "StructuralFirefighter", vehicleType: "PumperTruck",
        rescueCapability: "StructuralCollapse",
      }),
      createEnrichedResource({
        id: "AMB-1", name: "Ambulance 1", type: "Ambulance",
        responderSkill: "AdvancedParamedic", vehicleType: "AdvancedLifeSupport",
        medicalCapability: "AdvancedLifeSupport",
      }),
      createEnrichedResource({
        id: "POL-1", name: "Patrol Unit 1", type: "Police",
        responderSkill: "TacticalResponse", vehicleType: "PatrolCar",
        rescueCapability: "BasicExtraction",
      }),
      createEnrichedResource({
        id: "FIRE-2", name: "Fire Engine 2", type: "FireTruck",
        responderSkill: "HazmatCertified", vehicleType: "HeavyRescue",
        rescueCapability: "HeavyUrbanSAR",
      }),
      createEnrichedResource({
        id: "AMB-2", name: "Ambulance 2", type: "Ambulance",
        responderSkill: "BasicFirstAid", vehicleType: "BasicAmbulance",
        medicalCapability: "IntermediateCare",
      }),
      createEnrichedResource({
        id: "HOSP-1", name: "General Hospital", type: "Hospital",
        location: { latitude: 22.562, longitude: 88.492 },
        metadata: { availableBeds: 45, icuAvailable: true, specialties: ["Trauma", "Emergency"] },
      }),
      createEnrichedResource({
        id: "SHELTER-1", name: "Community Shelter", type: "Shelter",
        location: { latitude: 22.555, longitude: 88.489 },
        metadata: { capacity: 200, currentOccupancy: 68, amenities: ["Food", "Medical"] },
      }),
    ];

    const scores = scorer.scoreAll(resources, incident);
    return rankingService.rankResources(resources, scores, incident);
  }

  describe("buildAllocation", () => {
    it("should generate a valid allocation with all required fields", () => {
      const incident = createMockIncident({ incidentType: "Fire" });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.allocationId).toContain("ALLOC-SM-");
      expect(allocation.incidentId).toBe(incident.incidentId);
      expect(allocation.incidentType).toBe("Fire");
      expect(allocation.priority).toBe("HIGH");
      expect(allocation.allocatedResources.length).toBeGreaterThan(0);
      expect(allocation.allocationTimestamp).toBeDefined();
    });

    it("should create a primary team with members", () => {
      const incident = createMockIncident({ incidentType: "Fire" });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.primaryTeam).toBeDefined();
      expect(allocation.primaryTeam.teamRole).toBe("Primary");
      expect(allocation.primaryTeam.members.length).toBeGreaterThan(0);
      expect(allocation.primaryTeam.teamId).toContain("TEAM-PRIMARY-");
      expect(allocation.primaryTeam.totalCapabilityScore).toBeGreaterThan(0);
    });

    it("should create a backup team", () => {
      const incident = createMockIncident({ incidentType: "Fire" });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.backupTeam).toBeDefined();
      expect(allocation.backupTeam.teamRole).toBe("Backup");
      expect(allocation.backupTeam.teamId).toContain("TEAM-BACKUP-");
    });

    it("should include hospital assignments with bed info", () => {
      const incident = createMockIncident({ incidentType: "Fire" });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.hospitals.length).toBeGreaterThan(0);
      const hospital = allocation.hospitals[0];
      expect(hospital.resourceId).toBe("HOSP-1");
      expect(hospital.availableBeds).toBe(45);
      expect(hospital.icuAvailable).toBe(true);
      expect(hospital.specialties).toContain("Trauma");
    });

    it("should include shelter assignments with capacity info", () => {
      const incident = createMockIncident({ incidentType: "Fire" });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.shelters.length).toBeGreaterThan(0);
      const shelter = allocation.shelters[0];
      expect(shelter.resourceId).toBe("SHELTER-1");
      expect(shelter.capacity).toBe(200);
      expect(shelter.currentOccupancy).toBe(68);
      expect(shelter.remainingCapacity).toBe(132);
    });

    it("should compute estimated capacity with all counters", () => {
      const incident = createMockIncident({ incidentType: "Fire" });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.estimatedCapacity).toBeDefined();
      expect(allocation.estimatedCapacity.totalVehicles).toBeGreaterThan(0);
      expect(allocation.estimatedCapacity.hospitalBeds).toBeGreaterThanOrEqual(0);
      expect(allocation.estimatedCapacity.shelterSpaces).toBeGreaterThanOrEqual(0);
    });

    it("should generate a resource score between 0 and 100", () => {
      const incident = createMockIncident({ incidentType: "Fire" });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.resourceScore).toBeGreaterThanOrEqual(0);
      expect(allocation.resourceScore).toBeLessThanOrEqual(100);
    });

    it("should handle Medical incident type correctly", () => {
      const incident = createMockIncident({
        incidentType: "Medical Emergency",
        priority: "CRITICAL",
        estimatedVictims: 5,
      });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.incidentType).toBe("Medical Emergency");
      expect(allocation.primaryTeam.members.length).toBeGreaterThan(0);
    });

    it("should handle Flood incident type correctly", () => {
      const incident = createMockIncident({
        incidentType: "Flood",
        priority: "HIGH",
        estimatedVictims: 50,
      });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.incidentType).toBe("Flood");
      expect(allocation.allocatedResources.length).toBeGreaterThan(0);
    });

    it("should handle Earthquake incident type with higher scale factor", () => {
      const incident = createMockIncident({
        incidentType: "Earthquake",
        priority: "CRITICAL",
        estimatedVictims: 100,
      });
      const ranked = buildRankedResources(incident);
      const allocation = builder.buildAllocation(ranked, incident);

      expect(allocation.primaryTeam.members.length).toBeGreaterThan(0);
    });
  });
});
