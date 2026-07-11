import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventPublisher } from "@/infrastructure/events/event-publisher";
import { eventSubscriber } from "@/infrastructure/events/event-subscriber";
import { redisPubSub } from "@/infrastructure/events/redis-pubsub";
import { prisma } from "@/infrastructure/database/prisma-client";
import { riskEvaluationService } from "@/application/agents/risk-evaluator/risk-evaluation-service";

vi.mock("@/infrastructure/events/redis-pubsub", () => {
  return {
    redisPubSub: {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    },
  };
});

vi.mock("@/infrastructure/logger/pino", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/application/agents/risk-evaluator/risk-evaluation-service", () => ({
  riskEvaluationService: {
    evaluateIncidentRisk: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma-client", () => {
  return {
    prisma: {
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

describe("EventPublisher & EventSubscriber Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully publish an event on the first attempt", async () => {
    vi.mocked(redisPubSub.publish).mockResolvedValueOnce(undefined);

    const testEvent = {
      eventId: "evt-123",
      eventType: "RiskEvaluationStarted" as const,
      timestamp: new Date().toISOString(),
      correlationId: "corr-1",
      data: { incidentId: "INC-1" },
    };

    await eventPublisher.publish(testEvent);
    expect(redisPubSub.publish).toHaveBeenCalledTimes(1);
  });

  it("should retry on error and route to DLQ if max retries fail", async () => {
    vi.mocked(redisPubSub.publish).mockRejectedValue(new Error("Redis offline"));

    const testEvent = {
      eventId: "evt-123",
      eventType: "RiskEvaluationStarted" as const,
      timestamp: new Date().toISOString(),
      correlationId: "corr-1",
      data: { incidentId: "INC-1" },
    };

    // Override publisher settings locally to avoid long test delays
    const originalMax = (eventPublisher as any).maxRetries;
    const originalDelay = (eventPublisher as any).baseDelayMs;
    (eventPublisher as any).maxRetries = 2;
    (eventPublisher as any).baseDelayMs = 1;

    await eventPublisher.publish(testEvent);

    expect(redisPubSub.publish).toHaveBeenCalledTimes(3); // Initial + 1 retry + DLQ publish attempt

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1); // Saved to DLQ database audit logs

    // Restore publisher configuration
    (eventPublisher as any).maxRetries = originalMax;
    (eventPublisher as any).baseDelayMs = originalDelay;
  });

  it("should subscribe to IncidentCreated and orchestrate RiskEvaluationService", async () => {
    const mockIncidentCreated = {
      eventId: "evt-001",
      eventType: "IncidentCreated" as const,
      timestamp: new Date().toISOString(),
      correlationId: "corr-1",
      data: {
        incidentId: "INC-999",
        incidentType: "flood",
        confidence: 0.95,
        structuredDesc: "Flood at Sector-5",
      },
    };

    const mockAssessment = {
      id: "ra_999",
      incidentId: "INC-999",
      severity: "HIGH",
      priority: "HIGH",
      overallRiskScore: 78,
      confidence: 0.9,
      reasoning: "Heavy flooding",
      isProtocolZeroTriggered: false,
    };

    vi.mocked(riskEvaluationService.evaluateIncidentRisk).mockResolvedValueOnce(mockAssessment as any);
    vi.mocked(redisPubSub.publish).mockResolvedValue(undefined);

    // Mock the subscriber capture callback
    let capturedCallback: any;
    vi.mocked(redisPubSub.subscribe).mockImplementationOnce(async (channel, callback) => {
      capturedCallback = callback;
    });

    // Register listeners
    await eventSubscriber.startListening();

    expect(redisPubSub.subscribe).toHaveBeenCalledWith("argus:events:IncidentCreated", expect.any(Function));

    // Manually invoke the callback to simulate incident creation subscription firing
    await capturedCallback(mockIncidentCreated);

    expect(riskEvaluationService.evaluateIncidentRisk).toHaveBeenCalledWith("INC-999");
    // Verify starting and completion events are published
    expect(redisPubSub.publish).toHaveBeenCalledWith("argus:events:RiskEvaluationStarted", expect.any(Object));
    expect(redisPubSub.publish).toHaveBeenCalledWith("argus:events:RiskEvaluated", expect.any(Object));
  });
});
