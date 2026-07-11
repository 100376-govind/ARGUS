import { describe, it, expect } from "vitest";
import { threatClassificationEngine } from "@/application/agents/risk-evaluator/threat-engine";
import { severityEngine } from "@/application/agents/risk-evaluator/severity-engine";
import { priorityEngine, PriorityEngine } from "@/application/agents/risk-evaluator/priority-engine";
import { weightedRiskEngine, WeightedRiskEngine } from "@/application/agents/risk-evaluator/weighted-risk-engine";
import { predictionEngine } from "@/application/agents/risk-evaluator/prediction-engine";
import { impactEngine } from "@/application/agents/risk-evaluator/impact-engine";
import { confidenceEngine } from "@/application/agents/risk-evaluator/confidence-engine";
import { reasoningEngine } from "@/application/agents/risk-evaluator/reasoning-engine";
import { protocolZeroDecisionHelper } from "@/application/agents/risk-evaluator/protocol-helper";

describe("Core Risk Intelligence Engine Suite", () => {
  
  describe("1. Threat Classification Engine", () => {
    it("should classify subtypes into correct categories", () => {
      const floodDef = threatClassificationEngine.getThreatDefinition("urban_flood");
      expect(floodDef.category).toBe("FLOOD");
      expect(floodDef.escalationRules).toBeDefined();

      const quakeDef = threatClassificationEngine.getThreatDefinition("earthquake");
      expect(quakeDef.category).toBe("GEOLOGICAL");
    });

    it("should fallback to unknown category for unregistered types", () => {
      const fallbackDef = threatClassificationEngine.getThreatDefinition("extraterrestrial_invasion");
      expect(fallbackDef.subtype).toBe("unknown");
      expect(fallbackDef.category).toBe("UNKNOWN");
    });
  });

  describe("2. Severity Engine", () => {
    it("should calculate correct severity values", () => {
      const input = {
        incidentType: "urban_flood",
        victimCount: 12, // +20 severity
        hasHazmat: true, // +15 severity
        affectedInfrastructure: {
          hasHospitals: true, // +25 severity
          hasSchools: false,
          hasPowerGrid: false,
          hasBridgesOrRoads: false,
        },
        environment: {
          isExtremeWeather: true, // +10 severity
          isNightTime: false,
        },
        geminiAssessedSeverity: "CRITICAL" as const, // Gemini value = 80
      };

      // Base for urban_flood = 60
      // 60 + 20 + 15 + 25 + 10 = 130 -> Capped at 100 calculated
      // Blend: 100 * 0.6 + 80 * 0.4 = 92 (CATASTROPHIC)
      const res = severityEngine.calculateSeverity(input);
      expect(res.score).toBe(92);
      expect(res.level).toBe("CATASTROPHIC");
    });

    it("should handle minimal inputs without throwing", () => {
      const res = severityEngine.calculateSeverity({
        incidentType: "road_accident",
        victimCount: 0,
        hasHazmat: false,
        affectedInfrastructure: {
          hasHospitals: false,
          hasSchools: false,
          hasPowerGrid: false,
          hasBridgesOrRoads: false,
        },
        environment: {
          isExtremeWeather: false,
          isNightTime: false,
        },
        geminiAssessedSeverity: "LOW" as const,
      });

      expect(res.score).toBeLessThan(50);
      expect(res.level).toBe("LOW");
    });
  });

  describe("3. Priority Engine", () => {
    it("should calculate priority codes based on weights", () => {
      const input = {
        severityScore: 80,
        impactScore: 70,
        timeUrgencyScore: 90,
      };

      // Weights default: 0.5 severity, 0.3 impact, 0.2 time
      // 80*0.5 + 70*0.3 + 90*0.2 = 40 + 21 + 18 = 79
      // 79 -> P2 Priority
      const res = priorityEngine.calculatePriority(input);
      expect(res.score).toBe(79);
      expect(res.code).toBe("P2");
      expect(res.level).toBe("HIGH");
    });

    it("should support dynamic reconfiguration of weights", () => {
      const customCalculator = new PriorityEngine({
        severityWeight: 0.8,
        impactWeight: 0.1,
        timeUrgencyWeight: 0.1,
      });

      const res = customCalculator.calculatePriority({
        severityScore: 90,
        impactScore: 10,
        timeUrgencyScore: 10,
      });

      // 90*0.8 + 10*0.1 + 10*0.1 = 72 + 1 + 1 = 74 -> P2
      expect(res.score).toBe(74);
    });
  });

  describe("4. Weighted Risk Engine", () => {
    it("should compute dynamic weighted scores", () => {
      const input = {
        threatSubtype: "explosion", // baseline = 90
        victimCount: 30, // score = 100
        hasVulnerablePopulation: true, // score = 100
        affectedInfrastructureCount: 2, // score = 50
        hasHospitals: true, // score = 100
        hasSchools: false,
        hasHazmat: true, // score = 100
        isExtremeWeather: false,
        dispatcherConfidence: 90,
        geminiConfidence: 80,
      };

      const res = weightedRiskEngine.calculateRiskScore(input);
      expect(res.overallScore).toBeGreaterThan(60);
      expect(res.breakdown.threatScore).toBe(90);
      expect(res.breakdown.victimScore).toBe(100);
    });

    it("should handle custom configuration scales", () => {
      const engine = new WeightedRiskEngine({
        threatType: 0.5,
        victimCount: 0.5,
        infrastructure: 0,
        children: 0,
        hospitals: 0,
        schools: 0,
        hazmat: 0,
        weather: 0,
        dispatcherConfidence: 0,
        geminiConfidence: 0,
      });

      const res = engine.calculateRiskScore({
        threatSubtype: "explosion", // 90
        victimCount: 0, // 0
        hasVulnerablePopulation: false,
        affectedInfrastructureCount: 0,
        hasHospitals: false,
        hasSchools: false,
        hasHazmat: false,
        isExtremeWeather: false,
        dispatcherConfidence: 0,
        geminiConfidence: 0,
      });

      // 90 * 0.5 + 0 = 45 overall score
      expect(res.overallScore).toBe(45);
    });
  });

  describe("5. Prediction Engine", () => {
    it("should merge system baselines and Gemini forecasts", () => {
      const input = {
        incidentType: "fire",
        isExtremeWeather: true,
        victimCount: 5,
        hasHospitalsNearby: true,
        isNightTime: false,
        geminiPredictions: [
          {
            threatType: "fire_spread",
            probability: 0.9,
            impact: "CRITICAL" as const,
            estimatedTimeframe: "10m",
            confidence: 0.9,
          },
        ],
      };

      const predictions = predictionEngine.generatePredictions(input);
      
      const fireSpread = predictions.find((p) => p.threatType === "fire_spread");
      expect(fireSpread).toBeDefined();
      // Baseline fire_spread is 0.8
      // Gemini fire_spread is 0.9
      // Blended = 0.8*0.5 + 0.9*0.5 = 0.85
      expect(fireSpread!.probability).toBe(0.85);
      expect(fireSpread!.impact).toBe("CRITICAL");
    });
  });

  describe("6. Impact Estimation Engine", () => {
    it("should compute correct affected population scales", () => {
      const res = impactEngine.estimateImpact({
        incidentType: "explosion",
        victimCount: 15,
        locationDetails: {
          isHighDensityZone: true,
          hasSchoolNearby: true,
          hasHospitalNearby: true,
        },
      });

      // victims=15 * 10 = 150
      // high density = +250
      // type explosion = +1000
      // total = 1400 affected population
      expect(res.breakdown.population.affectedCount).toBe(1400);
      expect(res.breakdown.population.severity).toBe("CRITICAL");
      expect(res.overallImpactScore).toBeGreaterThan(40);
    });
  });

  describe("7. Confidence Engine", () => {
    it("should calculate correct data completeness and overall confidence", () => {
      const completeness = confidenceEngine.calculateDataCompleteness({
        hasLocation: true,
        hasReporterDetails: true,
        hasVictimCountExplicit: false,
        hasEntitiesExtracted: true,
      });

      // location=0.35, reporter=0.20, entities=0.20 = 0.75
      expect(completeness).toBe(0.75);

      const finalConf = confidenceEngine.calculateFinalConfidence({
        dispatcherConfidence: 90, // 0.9
        geminiConfidence: 80, // 0.8
        incidentFields: {
          hasLocation: true,
          hasReporterDetails: true,
          hasVictimCountExplicit: false,
          hasEntitiesExtracted: true,
        },
        predictionConfidences: [0.9, 0.8], // average = 0.85
      });

      // 0.9*0.3 + 0.8*0.3 + 0.75*0.2 + 0.85*0.2 = 0.27 + 0.24 + 0.15 + 0.17 = 0.83
      expect(finalConf).toBe(0.83);
    });
  });

  describe("8. Reasoning Engine", () => {
    it("should render bullet lists without revealing internal CoT", () => {
      const res = reasoningEngine.generateConciseReasoning({
        severityLevel: "CRITICAL",
        priorityCode: "P1",
        incidentType: "chemical_leak",
        victimCount: 2,
        hasHazmat: true,
        isExtremeWeather: false,
        affectedInfrastructure: ["Water Substation"],
        predictions: [
          {
            threatType: "toxic_leak",
            probability: 0.95,
            impact: "CRITICAL",
            estimatedTimeframe: "immediate",
            confidence: 0.95,
          },
        ],
        geminiReasoning: "Raw reasoning from Gemini",
      });

      expect(res.bullets).toContain("Life safety threat confirmed: 2 victims reported");
      expect(res.bullets).toContain("Critical incident type identified: chemical leak");
      expect(res.summary).toContain("P1");
      // Verify no mention of step-by-step reasoning flags
      expect(res.summary).not.toContain("first step");
    });
  });

  describe("9. Protocol Zero Decision Helper", () => {
    it("should trigger Protocol Zero on risk scores >= 90", () => {
      const res = protocolZeroDecisionHelper.evaluateProtocolZeroTrigger({
        overallRiskScore: 92,
        severityLevel: "CATASTROPHIC",
        victimCount: 0,
        hasHazmat: false,
        isExtremeWeather: false,
        isNightTime: false,
        impact: {
          overallImpactScore: 50,
          breakdown: {
            population: { affectedCount: 10, severity: "LOW" },
            buildings: { damagedCount: 0, structuralIntegrityLost: false },
            hospitals: { affectedCount: 0, isOperational: true },
            roads: { blockedRoutesCount: 0, evacuationRouteCutoff: false },
            powerGrid: { nodesAffectedCount: 0, outageDurationEstimatedHours: 0 },
            schools: { closedCount: 0, shelterCapacityAvailable: false },
          },
        },
        incidentType: "power_failure",
        geminiTriggered: false,
        geminiReason: "",
      });

      expect(res.triggered).toBe(true);
      expect(res.reason).toContain("Overall risk score of 92 exceeds extreme safety threshold");
    });

    it("should trigger override if hazmat threatens operational status of hospitals", () => {
      const res = protocolZeroDecisionHelper.evaluateProtocolZeroTrigger({
        overallRiskScore: 75,
        severityLevel: "CRITICAL",
        victimCount: 0,
        hasHazmat: true,
        isExtremeWeather: false,
        isNightTime: false,
        impact: {
          overallImpactScore: 60,
          breakdown: {
            population: { affectedCount: 10, severity: "LOW" },
            buildings: { damagedCount: 0, structuralIntegrityLost: false },
            hospitals: { affectedCount: 1, isOperational: true }, // hospital affected
            roads: { blockedRoutesCount: 0, evacuationRouteCutoff: false },
            powerGrid: { nodesAffectedCount: 0, outageDurationEstimatedHours: 0 },
            schools: { closedCount: 0, shelterCapacityAvailable: false },
          },
        },
        incidentType: "chemical_leak",
        geminiTriggered: false,
        geminiReason: "",
      });

      expect(res.triggered).toBe(true);
      expect(res.reason).toContain("Hazardous materials leak detected in close proximity to critical medical facilities");
    });
  });
});
