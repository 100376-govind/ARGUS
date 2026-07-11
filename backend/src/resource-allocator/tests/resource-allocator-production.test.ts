import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductionResourceAllocatorService } from "../services/production-resource-allocator.service";
import { resourceAllocatorService } from "../services/resource-allocator.service";

// Mock Firebase storage admin setup completely
vi.mock("firebase-admin", () => ({
  apps: [{ name: "mock-app" }],
  initializeApp: vi.fn(),
  credential: {
    cert: vi.fn(),
  },
  storage: vi.fn().mockImplementation(() => ({
    bucket: vi.fn().mockImplementation(() => ({
      file: vi.fn(),
    })),
  })),
  app: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@/infrastructure/database/prisma-client", () => ({
  prisma: {
    systemEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@/infrastructure/redis/redis-client", () => ({
  redisPublisher: {
    publish: vi.fn().mockResolvedValue(1),
  },
  redisSubscriber: {
    on: vi.fn(),
    subscribe: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/application/shared-memory/shared-incident-memory", () => {
  return {
    SharedIncidentMemory: vi.fn().mockImplementation(() => ({
      read: vi.fn().mockResolvedValue({ id: "INC-99", incidentType: "Fire" }),
      write: vi.fn().mockResolvedValue({}),
      getLatestAgentOutput: vi.fn().mockResolvedValue(null),
      getAgentChain: vi.fn().mockResolvedValue([]),
    })),
  };
});

describe("Production Resource Allocator Integration", () => {
  let prodService: ProductionResourceAllocatorService;

  beforeEach(() => {
    prodService = new ProductionResourceAllocatorService(resourceAllocatorService);
  });

  it("should execute production allocation pipeline successfully", async () => {
    const incidentInput = {
      incidentId: "INC-99",
      incidentType: "Fire",
      priority: "HIGH" as const,
      validationStatus: "VALIDATED" as const,
      validationConfidence: 100,
      location: { latitude: 22.557827, longitude: 88.49682 },
      coordinates: { latitude: 22.557827, longitude: 88.49682 },
      estimatedVictims: 5,
    };

    const res = await prodService.allocate(incidentInput);
    expect(res).toBeDefined();
    expect(res.status).toBe("completed");
    expect(res.incidentId).toBe("INC-99");
    expect(res.allocation).toBeDefined();
    expect(res.dispatchPlan).toBeDefined();
  });
});
