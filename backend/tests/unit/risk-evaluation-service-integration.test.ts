import { describe, it, expect, vi, beforeEach } from "vitest";
import { RiskEvaluationService } from "@/application/agents/risk-evaluator/risk-evaluation-service";
import { prisma } from "@/infrastructure/database/prisma-client";
import { riskEvaluatorCache } from "@/infrastructure/redis/risk-evaluator-cache";
import { SeverityLevel, PriorityLevel } from "@/domain/entities/risk-evaluator";

// Mock Logger
vi.mock("@/infrastructure/logger/pino", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Redis Cache
vi.mock("@/infrastructure/redis/risk-evaluator-cache", () => {
  return {
    riskEvaluatorCache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock Prisma Client transaction
vi.mock("@/infrastructure/database/prisma-client", () => {
  return {
    prisma: {
      $transaction: vi.fn(),
    },
  };
});

describe("RiskEvaluationService Integration Tests", () => {
  let service: RiskEvaluationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RiskEvaluationService();
  });

  it("should integrate calculations from all sub-engines correctly", async () => {
    // 1. Setup mock incident
    const mockIncident = {
      id: "INC-INT-200",
      version: 1,
      status: "pending",
      source: "text",
      incidentType: "chemical_leak",
      rawContent: "Chlorine gas leak at Sector-7 refinery near hospital",
      structuredDesc: "A chlorine gas leak has occurred in the refinery at Sector-7 near hospital.",
      confidence: 100,
      reporterId: "rep-2",
      locationName: "Sector-7 Refinery",
      extractedEntities: {
        locations: ["refinery", "hospital", "Sector-7"],
        hazards: ["chlorine gas", "leak"],
        people: ["workers"],
        vehicles: [],
        organizations: [],
      },
      metadata: {
        weather: { isExtreme: true },
        damage: { gridNodesOfflineCount: 4 },
      },
    };

    // 2. Setup mock Gemini response
    const mockGeminiResponse = {
      severity: "CRITICAL" as const,
      priority: "CRITICAL" as const,
      confidence: 0.95,
      incidentType: "chemical_leak",
      predictions: [
        {
          threatType: "toxic_leak",
          probability: 0.95,
          impact: "CRITICAL" as const,
          estimatedTimeframe: "immediate",
          confidence: 0.95,
        },
      ],
      reasoning: "Chlorine leak near critical hospital. Extreme safety override.",
      recommendedActions: ["Trigger city warning alarm", "Deploy level-A suits"],
      protocolZero: {
        triggered: true,
        reason: "Refinery toxic plume expanding toward medical care zone.",
      },
    };

    const mockDbRiskAssessment = {
      id: "ra_int_200",
      incidentId: "INC-INT-200",
      severity: "CRITICAL",
      priority: "CRITICAL",
      overallRiskScore: 95,
      confidence: 0.9,
      reasoning: "Chlorine leak reasoning summary",
      isProtocolZeroTriggered: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mocking internally accessed services/clients
    service["sharedMemoryIntegration"].readIncident = vi.fn().mockResolvedValueOnce(mockIncident);
    service["geminiClient"].evaluateRisk = vi.fn().mockResolvedValueOnce(mockGeminiResponse);

    // Mock transaction & database writes
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
      return callback({});
    });

    service["riskAssessmentRepo"].create = vi.fn().mockResolvedValueOnce(mockDbRiskAssessment);
    service["predictionRepo"].create = vi.fn().mockResolvedValueOnce({
      id: "tp_int_2",
      riskAssessmentId: "ra_int_200",
      threatType: "toxic_leak",
      probability: 0.95,
      impact: "CRITICAL",
      estimatedTimeframe: "immediate",
      confidence: 0.95,
      createdAt: new Date(),
    });
    service["severityRepo"].create = vi.fn();
    service["priorityRepo"].create = vi.fn();
    service["reasoningRepo"].create = vi.fn();
    service["protocolZeroRepo"].create = vi.fn();

    service["sharedMemoryIntegration"].appendRiskEvaluatorData = vi.fn().mockResolvedValueOnce({});

    // 3. Execute integrated service call
    const result = await service.evaluateIncidentRisk("INC-INT-200");

    // 4. Verify result mappings and integrated outputs
    expect(result.incidentId).toBe("INC-INT-200");
    expect(result.severity).toBe("CATASTROPHIC" as SeverityLevel);
    expect(result.priority).toBe("HIGH" as PriorityLevel);

    expect(result.isProtocolZeroTriggered).toBe(true);
    expect(result.threatPredictions?.length).toBeGreaterThanOrEqual(1);
    expect(result.threatPredictions?.some(p => p.threatType === "toxic_leak")).toBe(true);

  });
});
