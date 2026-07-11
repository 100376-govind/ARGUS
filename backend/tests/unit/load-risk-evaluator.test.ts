import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/risk/evaluate/route";
import { riskEvaluationService } from "@/application/agents/risk-evaluator/risk-evaluation-service";
import { logger } from "@/infrastructure/logger/pino";

vi.mock("@/application/agents/risk-evaluator/risk-evaluation-service", () => ({
  riskEvaluationService: {
    evaluateIncidentRisk: vi.fn().mockImplementation(async (id: string) => {
      // Simulate database and network delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        id: `ra_${id}`,
        incidentId: id,
        severity: "CRITICAL",
        priority: "CRITICAL",
        overallRiskScore: 95,
      };
    }),
  },
}));

vi.mock("@/infrastructure/logger/pino", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/infrastructure/redis/risk-evaluator-cache", () => {
  return {
    riskEvaluatorCache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe("Risk Evaluator Concurrency & Load Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (incidentId: string) => {
    return new NextRequest("http://localhost/api/risk/evaluate", {
      method: "POST",
      headers: new Headers({
        "Authorization": "Bearer mock-dispatcher-token",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ incidentId }),
    });
  };

  it("should handle 50 parallel evaluate requests gracefully under load", async () => {
    const totalRequests = 50;
    const requestPromises = [];

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const req = createRequest(`INC-LOAD-${i}`);
      requestPromises.push(POST(req));
    }

    // Execute all requests concurrently
    const responses = await Promise.all(requestPromises);

    const totalDuration = Date.now() - startTime;
    logger.info({ totalRequests, totalDurationMs: totalDuration }, "Load Tests completed");

    // Verify all responses returned 201 Created
    responses.forEach((res, idx) => {
      expect(res.status).toBe(201);
    });

    expect(riskEvaluationService.evaluateIncidentRisk).toHaveBeenCalledTimes(totalRequests);
  }, 15000); // 15 seconds timeout
});
