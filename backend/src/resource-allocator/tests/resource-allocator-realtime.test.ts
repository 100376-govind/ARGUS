import { describe, it, expect, vi } from "vitest";

// Mock firebase-admin completely
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

// Mock PrismaClient to prevent database connections during unit tests
vi.mock("@/infrastructure/database/prisma-client", () => ({
  prisma: {
    systemEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Mock Redis client to prevent real Redis publisher/subscriber calls
vi.mock("@/infrastructure/redis/redis-client", () => ({
  redisPublisher: {
    publish: vi.fn().mockResolvedValue(1),
  },
  redisSubscriber: {
    on: vi.fn(),
    subscribe: vi.fn().mockResolvedValue({}),
  },
}));

import { ResourceAllocatorApiController } from "../controllers/resource-allocator-api.controller";
import { RealtimeEventDispatcher } from "../services/realtime-event-dispatcher.service";
import { NextRequest } from "next/server";

// Mock the Auth hook and SharedIncidentMemory
vi.mock("@/presentation/middleware/auth.hooks", () => ({
  AuthenticationHooks: {
    authenticate: vi.fn().mockResolvedValue({ userId: "user-1", role: "Commander" }),
    authorize: vi.fn(),
  },
}));

vi.mock("@/application/shared-memory/shared-incident-memory", () => {
  return {
    SharedIncidentMemory: vi.fn().mockImplementation(() => ({
      read: vi.fn().mockResolvedValue({ id: "INC-99", incidentType: "Fire" }),
      getLatestAgentOutput: vi.fn().mockImplementation((id, agent) => {
        if (agent === "resource-matching-engine") {
          return {
            outputData: {
              allocatedResources: [],
              resourceScore: 85,
              selectedTeams: {
                primary: { teamId: "TEAM-1", memberCount: 2, avgCapabilityScore: 85 },
                backup: { teamId: "TEAM-2", memberCount: 1, avgCapabilityScore: 70 },
              },
              hospitals: [],
              shelters: [],
              estimatedCapacity: {},
            },
          };
        }
        return {
          outputData: {
            dispatchPlan: [],
            eta: 10,
            distance: 5.5,
            routeStatus: "Optimal",
            estimatedArrival: "2026-07-11T12:00:00Z",
          },
        };
      }),
      getAgentChain: vi.fn().mockResolvedValue([]),
    })),
  };
});

describe("Resource Allocator REST APIs and Sockets", () => {
  it("should get allocation details through api controller", async () => {
    const controller = new ResourceAllocatorApiController();
    const req = new NextRequest("http://localhost:3001/api/resource-allocator/INC-99");
    const response = await controller.getAllocationDetails(req, { params: { incidentId: "INC-99" } });
    
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.incidentId).toBe("INC-99");
  });

  it("should dispatch real-time events properly", async () => {
    const dispatcher = new RealtimeEventDispatcher();
    // Verify it can execute without throwing when socket server isn't instantiated
    await expect(dispatcher.publishAllocationStarted("INC-99")).resolves.not.toThrow();
  });
});
