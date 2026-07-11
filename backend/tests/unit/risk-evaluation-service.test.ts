import { describe, it, expect, vi, beforeEach } from "vitest";
import { riskEvaluationService } from "@/application/agents/risk-evaluator/risk-evaluation-service";
import { riskEvaluatorCache } from "@/infrastructure/redis/risk-evaluator-cache";
import { prisma } from "@/infrastructure/database/prisma-client";
import { IncidentNotFoundError, InvalidIncidentError } from "@/shared/errors/risk-evaluator-service-errors";

// Mock the Logger
vi.mock("@/infrastructure/logger/pino", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Use vi.hoisted for variables that need to be accessed inside hoisted vi.mock calls
const mocks = vi.hoisted(() => {
  return {
    mockEvaluateRisk: vi.fn(),
    mockReadIncident: vi.fn(),
    mockAppendRiskEvaluatorData: vi.fn(),
  };
});

// Mock the Gemini Client singleton
vi.mock("@/infrastructure/gemini/risk-evaluator-gemini-client", () => {
  return {
    RiskEvaluatorGeminiClient: {
      getInstance: vi.fn().mockImplementation(() => {
        return {
          evaluateRisk: mocks.mockEvaluateRisk,
        };
      }),
    },
  };
});

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

// Mock Shared Memory Integration
vi.mock("@/application/agents/risk-evaluator/shared-memory-integration", () => {
  return {
    SharedIncidentMemoryIntegration: vi.fn().mockImplementation(() => {
      return {
        readIncident: mocks.mockReadIncident,
        appendRiskEvaluatorData: mocks.mockAppendRiskEvaluatorData,
      };
    }),
  };
});

// Mock Prisma Client transaction
vi.mock("@/infrastructure/database/prisma-client", () => {
  return {
    prisma: {
      $transaction: vi.fn(),
      riskAssessment: {
        create: vi.fn(),
      },
      threatPrediction: {
        create: vi.fn(),
      },
      severityHistory: {
        create: vi.fn(),
      },
      priorityHistory: {
        create: vi.fn(),
      },
      reasoningLog: {
        create: vi.fn(),
      },
      protocolZeroRequest: {
        create: vi.fn(),
      },
    },
  };
});

describe("RiskEvaluationService Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw IncidentNotFoundError if incident is missing in shared memory", async () => {
    mocks.mockReadIncident.mockResolvedValueOnce(null);

    await expect(
      riskEvaluationService.evaluateIncidentRisk("INC-MISSING")
    ).rejects.toThrow(IncidentNotFoundError);
  });

  it("should throw InvalidIncidentError if incident is incomplete", async () => {
    const incompleteIncident = {
      id: "INC-BAD",
      // missing structuredDesc and incidentType
    };
    mocks.mockReadIncident.mockResolvedValueOnce(incompleteIncident);

    await expect(
      riskEvaluationService.evaluateIncidentRisk("INC-BAD")
    ).rejects.toThrow(InvalidIncidentError);
  });

  it("should return cached risk assessment if present in Redis", async () => {
    const cachedAssessment = {
      id: "ra_cached_001",
      incidentId: "INC-001",
      severity: "MEDIUM",
      priority: "MEDIUM",
      overallRiskScore: 45,
      confidence: 0.8,
      reasoning: "Test",
    };
    vi.mocked(riskEvaluatorCache.get).mockResolvedValueOnce(cachedAssessment);

    const result = await riskEvaluationService.evaluateIncidentRisk("INC-001");
    expect(result).toEqual(cachedAssessment);
    expect(mocks.mockReadIncident).not.toHaveBeenCalled();
  });

  it("should orchestrate full evaluation flow, save to DB, memory, and cache", async () => {
    const mockIncident = {
      id: "INC-100",
      version: 1,
      status: "pending",
      source: "text",
      incidentType: "urban_fire",
      rawContent: "Building fire at sector-7 school",
      structuredDesc: "A building fire has broken out at Sector-7 school",
      confidence: 95,
      reporterId: "rep-1",
      locationName: "Sector-7 school",
      extractedEntities: {
        locations: ["school", "Sector-7"],
        hazards: ["fire"],
        people: ["kids", "teacher"],
        vehicles: [],
        organizations: [],
      },
      metadata: {
        weather: { isExtreme: false },
        damage: { buildingsCount: 1 },
      },
    };

    const mockGeminiResponse = {
      severity: "HIGH" as const,
      priority: "HIGH" as const,
      confidence: 0.9,
      incidentType: "urban_fire",
      predictions: [
        {
          threatType: "fire_spread",
          probability: 0.7,
          impact: "HIGH" as const,
          estimatedTimeframe: "immediate",
          confidence: 0.85,
        },
      ],
      reasoning: "School fire is active, high risk of expansion.",
      recommendedActions: ["Dispatch fire trucks"],
      protocolZero: {
        triggered: false,
        reason: "",
      },
    };

    const mockDbRiskAssessment = {
      id: "ra_test_100",
      incidentId: "INC-100",
      severity: "HIGH",
      priority: "HIGH",
      overallRiskScore: 75,
      confidence: 0.85,
      reasoning: "Test reasoning summary",
      isProtocolZeroTriggered: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mocks.mockReadIncident.mockResolvedValueOnce(mockIncident);
    mocks.mockEvaluateRisk.mockResolvedValueOnce(mockGeminiResponse);

    // Mock prisma transaction to yield database record
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
      // Mock repository methods
      const mockTx = {};
      return callback(mockTx);
    });


    // Mock direct repositories creation inside the transaction
    const originalCreate = riskEvaluationService["riskAssessmentRepo"].create;
    riskEvaluationService["riskAssessmentRepo"].create = vi.fn().mockResolvedValueOnce(mockDbRiskAssessment);
    riskEvaluationService["predictionRepo"].create = vi.fn().mockResolvedValueOnce({
      id: "tp_1",
      riskAssessmentId: "ra_test_100",
      threatType: "fire_spread",
      probability: 0.75,
      impact: "HIGH",
      estimatedTimeframe: "immediate",
      confidence: 0.85,
      createdAt: new Date(),
    });
    riskEvaluationService["severityRepo"].create = vi.fn();
    riskEvaluationService["priorityRepo"].create = vi.fn();
    riskEvaluationService["reasoningRepo"].create = vi.fn();
    riskEvaluationService["protocolZeroRepo"].create = vi.fn();

    // Mock shared memory append and Redis caching
    mocks.mockAppendRiskEvaluatorData.mockResolvedValueOnce({});

    const assessment = await riskEvaluationService.evaluateIncidentRisk("INC-100");

    expect(assessment.incidentId).toBe("INC-100");
    expect(assessment.severity).toBe("CRITICAL");

    expect(assessment.priority).toBe("HIGH");
    expect(mocks.mockEvaluateRisk).toHaveBeenCalledWith("INC-100", "urban_fire", expect.any(Object));
    expect(mocks.mockAppendRiskEvaluatorData).toHaveBeenCalledTimes(1);
    expect(riskEvaluatorCache.set).toHaveBeenCalledTimes(1);

    // Restore original repos
    riskEvaluationService["riskAssessmentRepo"].create = originalCreate;
  });
});
