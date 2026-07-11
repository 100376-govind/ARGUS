import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/risk/evaluate/route";
import { riskEvaluationService } from "@/application/agents/risk-evaluator/risk-evaluation-service";
import { eventPublisher } from "@/infrastructure/events/event-publisher";
import { socketGateway } from "@/infrastructure/sockets/socket-gateway";
import { riskEvaluatorCache } from "@/infrastructure/redis/risk-evaluator-cache";

// Mock out the underlying database writes and Gemini network layers
vi.mock("@/application/agents/risk-evaluator/risk-evaluation-service", () => ({
  riskEvaluationService: {
    evaluateIncidentRisk: vi.fn(),
  },
}));

vi.mock("@/infrastructure/events/event-publisher", () => ({
  eventPublisher: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/infrastructure/sockets/socket-gateway", () => ({
  socketGateway: {
    broadcastRiskUpdated: vi.fn(),
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

describe("Presentation & Communication Layer Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: any) => {
    return new NextRequest("http://localhost/api/risk/evaluate", {
      method: "POST",
      headers: new Headers({
        "Authorization": "Bearer mock-dispatcher-token",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
    });
  };

  it("should process route POST evaluate end-to-end through controller and emit alerts", async () => {
    const mockAssessment = {
      id: "ra_int_500",
      incidentId: "INC-INT-500",
      severity: "CRITICAL",
      priority: "CRITICAL",
      overallRiskScore: 92,
      confidence: 0.95,
      reasoning: "Plume gas expansion active",
      isProtocolZeroTriggered: true,
      threatPredictions: [],
    };

    vi.mocked(riskEvaluationService.evaluateIncidentRisk).mockResolvedValueOnce(mockAssessment as any);

    const req = createRequest({ incidentId: "INC-INT-500" });

    // Execute route handler POST
    const response = await POST(req);
    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.message).toBe("Incident evaluated successfully");
    expect(json.data.id).toBe("ra_int_500");
    expect(json.data.severity).toBe("CRITICAL");

    // Verify service orchestration
    expect(riskEvaluationService.evaluateIncidentRisk).toHaveBeenCalledWith("INC-INT-500");
  });
});
