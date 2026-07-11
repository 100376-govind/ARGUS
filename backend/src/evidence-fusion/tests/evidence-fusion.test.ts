import { vi } from "vitest";
import { EvidenceSource, EvidenceResult } from "../models/evidence-models";
import { EvidenceNormalizationService } from "../services/normalization.service";
import { EvidenceWeightEngine } from "../config/weight-engine";
import { ConflictDetectionService } from "../services/conflict-detection.service";
import { ValidationSummaryService } from "../services/validation-summary.service";
import { EvidenceFusionService } from "../services/fusion.service";
import { ValidationReportBuilder } from "../services/report-builder";
import { EvidenceFusionSharedMemoryIntegration } from "../services/shared-memory-integration";
import { SharedIncidentMemory } from "../../application/shared-memory/shared-incident-memory";

// Mock Gemini ValidationSummaryService
vi.mock("../services/validation-summary.service", () => {
  return {
    ValidationSummaryService: vi.fn().mockImplementation(() => ({
      generateSummary: vi.fn().mockResolvedValue({
        summary: "Flooding reports verified by rain observations.",
        supportingObservations: ["Precipitation confirmed by weather logs."],
        conflictingObservations: [],
        finalRecommendation: "Dispatch disaster response teams."
      })
    }))
  };
});

// Mock SharedIncidentMemory
const mockSharedMemory = {
  read: vi.fn().mockResolvedValue({ incidentId: "inc-123", agentExecutionHistory: [] }),
  write: vi.fn().mockResolvedValue(undefined)
} as unknown as SharedIncidentMemory;

describe("Evidence Fusion Engine Tests", () => {
  describe("EvidenceNormalizationService", () => {
    it("should normalize raw input data properly", () => {
      const service = new EvidenceNormalizationService();
      const raw = {
        confidence: 85,
        status: "success",
        observations: ["Observation A", "Observation B"]
      };

      const result = service.normalize(EvidenceSource.CitizenReport, raw);
      expect(result.confidence).toBe(85);
      expect(result.status).toBe("success");
      expect(result.observations).toContain("Observation A");
    });

    it("should fall back to safe values on bad format", () => {
      const service = new EvidenceNormalizationService();
      const result = service.normalize(EvidenceSource.CitizenReport, null);
      expect(result.confidence).toBe(0);
      expect(result.status).toBe("unavailable");
      expect(result.observations.length).toBe(0);
    });
  });

  describe("EvidenceWeightEngine", () => {
    it("should fetch default weights correctly", () => {
      const engine = new EvidenceWeightEngine();
      expect(engine.getWeight(EvidenceSource.CitizenReport)).toBe(0.25);
      expect(engine.getWeight(EvidenceSource.RiskEvaluator)).toBe(0.20);
    });

    it("should support updates to weights configuration", () => {
      const engine = new EvidenceWeightEngine();
      engine.updateWeights({ [EvidenceSource.CitizenReport]: 0.30 });
      expect(engine.getWeight(EvidenceSource.CitizenReport)).toBe(0.30);
    });
  });

  describe("ConflictDetectionService", () => {
    it("should flag flooding report conflicts against no precipitation weather", () => {
      const detector = new ConflictDetectionService();
      const evidences: EvidenceResult[] = [
        {
          source: EvidenceSource.CitizenReport,
          confidence: 90,
          status: "success",
          observations: ["Severe flood in central district"],
          timestamp: Date.now()
        },
        {
          source: EvidenceSource.Weather,
          confidence: 95,
          status: "success",
          observations: ["Dry conditions", "Clear sky"],
          timestamp: Date.now()
        }
      ];

      const assessment = detector.detectConflicts(evidences);
      expect(assessment.conflictingObservations[0]).toContain("no recent precipitation");
    });

    it("should generate supporting feedback for matching seismic history and building collapse", () => {
      const detector = new ConflictDetectionService();
      const evidences: EvidenceResult[] = [
        {
          source: EvidenceSource.CitizenReport,
          confidence: 90,
          status: "success",
          observations: ["Building collapse reported"],
          timestamp: Date.now()
        },
        {
          source: EvidenceSource.HistoricalIncidents,
          confidence: 85,
          status: "success",
          observations: ["Seismic zone boundary region"],
          timestamp: Date.now()
        }
      ];

      const assessment = detector.detectConflicts(evidences);
      expect(assessment.supportingObservations[0]).toContain("Seismic history confirms location is prone");
    });
  });

  describe("EvidenceFusionService", () => {
    it("should calculate correct weighted status score", async () => {
      const weightEngine = new EvidenceWeightEngine();
      const detector = new ConflictDetectionService();
      const summaryService = new ValidationSummaryService();
      const fusion = new EvidenceFusionService(weightEngine, detector, summaryService);

      const evidences: EvidenceResult[] = [
        { source: EvidenceSource.CitizenReport, confidence: 100, status: "success", observations: [], timestamp: 0 },
        { source: EvidenceSource.RiskEvaluator, confidence: 80, status: "success", observations: [], timestamp: 0 }
      ];

      const result = await fusion.fuse(evidences);
      // Citizen Report weight = 0.25, Risk Evaluator weight = 0.20
      // Score = (100 * 0.25 + 80 * 0.20) / (0.25 + 0.20) = (25 + 16) / 0.45 = 41 / 0.45 = 91.11 => 91
      expect(result.overallValidationScore).toBe(91);
      expect(result.validationStatus).toBe("Verified");
    });
  });

  describe("ValidationReportBuilder", () => {
    it("should correctly compile report details and limit bullet observations to 5 max", () => {
      const builder = new ValidationReportBuilder();
      const fusionResult = {
        overallValidationScore: 85,
        validationStatus: "Likely Valid" as const,
        supportingEvidence: ["Supp 1", "Supp 2", "Supp 3"],
        conflictingEvidence: [],
        evidenceBreakdown: []
      };

      const geminiSummary = {
        summary: "Analyzed all evidence",
        supportingObservations: ["Supp 4", "Supp 5", "Supp 6"],
        conflictingObservations: [],
        finalRecommendation: "Check report status"
      };

      const report = builder.buildReport("inc-123", fusionResult, geminiSummary);
      expect(report.supportingEvidence.length).toBe(5); // Capped at 5
    });
  });

  describe("Shared Memory Integration", () => {
    it("should append the validation report to memory", async () => {
      const integration = new EvidenceFusionSharedMemoryIntegration(mockSharedMemory);
      const report = {
        incidentId: "inc-123",
        validationStatus: "Likely Valid" as const,
        validationScore: 80,
        evidenceBreakdown: [],
        supportingEvidence: [],
        conflictingEvidence: [],
        summary: "Consensus analysis",
        recommendation: "Response path",
        timestamp: Date.now()
      };

      await integration.appendValidationReport(report);
      expect(mockSharedMemory.write).toHaveBeenCalledWith("inc-123", "evidence-fusion", expect.any(Object));
    });
  });
});
