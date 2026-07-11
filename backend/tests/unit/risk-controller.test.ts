import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { riskController } from "@/presentation/controllers/risk.controller";
import { riskEvaluationService } from "@/application/agents/risk-evaluator/risk-evaluation-service";
import { prisma } from "@/infrastructure/database/prisma-client";
import { AppError } from "@/shared/errors/app-error";
import { AuthenticationHooks } from "@/presentation/middleware/auth.hooks";


vi.mock("@/application/agents/risk-evaluator/risk-evaluation-service", () => ({
  riskEvaluationService: {
    evaluateIncidentRisk: vi.fn(),
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

vi.mock("@/infrastructure/database/prisma-client", () => {
  return {
    prisma: {
      $transaction: vi.fn(),
      riskAssessment: {
        count: vi.fn().mockResolvedValue(10),
        groupBy: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _avg: { overallRiskScore: 65 } }),
      },
    },
  };
});

describe("RiskController Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (url: string, method: string, headers: Record<string, string>, body?: any) => {
    return new NextRequest(url, {
      method,
      headers: new Headers(headers),
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  it("should block POST evaluate with 401 if unauthorized token", async () => {
    const req = createRequest("http://localhost/api/risk/evaluate", "POST", {
      "Authorization": "Bearer bad-token",
    }, { incidentId: "INC-123" });

    // Mock authenticate to fail directly
    vi.spyOn(AuthenticationHooks, "authenticate").mockRejectedValueOnce(
      new AppError(401, "UNAUTHORIZED", "Access token is missing or invalid")
    );

    await expect(riskController.evaluate(req)).rejects.toThrow(AppError);
  }, 10000);

  it("should evaluate risk successfully for Dispatcher role", async () => {
    const req = createRequest("http://localhost/api/risk/evaluate", "POST", {
      "Authorization": "Bearer mock-dispatcher-token",
    }, { incidentId: "INC-100" });

    const mockAssessment = {
      id: "ra_100",
      incidentId: "INC-100",
      severity: "HIGH",
      priority: "HIGH",
    };
    vi.mocked(riskEvaluationService.evaluateIncidentRisk).mockResolvedValueOnce(mockAssessment as any);

    const response = await riskController.evaluate(req);
    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.incidentId).toBe("INC-100");
  });

  it("should reject evaluation if incidentId payload is missing", async () => {
    const req = createRequest("http://localhost/api/risk/evaluate", "POST", {
      "Authorization": "Bearer mock-dispatcher-token",
    }, {}); // missing incidentId

    await expect(riskController.evaluate(req)).rejects.toThrow();
  });

  it("should get assessment by incident ID correctly", async () => {
    const req = createRequest("http://localhost/api/risk/INC-100", "GET", {
      "Authorization": "Bearer mock-dispatcher-token",
    });

    const mockAssessment = {
      id: "ra_100",
      incidentId: "INC-100",
      severity: "HIGH",
    };
    riskController["riskRepo"].findByIncidentId = vi.fn().mockResolvedValueOnce(mockAssessment);

    const response = await riskController.getByIncidentId(req, { params: { incidentId: "INC-100" } });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.data.severity).toBe("HIGH");
  });

  it("should allow Commander or Admin to update risk levels", async () => {
    const req = createRequest("http://localhost/api/risk/INC-100", "PATCH", {
      "Authorization": "Bearer mock-commander-token",
    }, { severity: "CRITICAL", priority: "CRITICAL" });

    const mockAssessment = {
      id: "ra_100",
      incidentId: "INC-100",
      severity: "HIGH",
      priority: "HIGH",
    };

    riskController["riskRepo"].findByIncidentId = vi.fn().mockResolvedValueOnce(mockAssessment);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
      return callback({});
    });
    riskController["riskRepo"].update = vi.fn().mockResolvedValueOnce({
      ...mockAssessment,
      severity: "CRITICAL",
      priority: "CRITICAL",
    });
    riskController["severityRepo"].create = vi.fn();
    riskController["priorityRepo"].create = vi.fn();

    const response = await riskController.update(req, { params: { incidentId: "INC-100" } });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.data.severity).toBe("CRITICAL");
  });

  it("should fetch statistics correctly", async () => {
    const req = createRequest("http://localhost/api/risk/statistics", "GET", {
      "Authorization": "Bearer mock-admin-token",
    });

    const response = await riskController.getStatistics(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.totalEvaluated).toBe(10);
  });
});
