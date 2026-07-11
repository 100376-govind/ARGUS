import { describe, it, expect, vi, beforeEach } from "vitest";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { IncidentEntity } from "@/domain/entities/incident";

// ─── Mock Repository ─────────────────────────────────

function createMockIncident(overrides?: Partial<IncidentEntity>): IncidentEntity {
  return {
    id: "INC-1000",
    version: 1,
    status: "pending",
    source: "text",
    incidentType: "fire",
    rawContent: "Fire detected in sector 7",
    structuredDesc: "A fire has been detected in sector 7.",
    confidence: 0.92,
    lat: 28.6139,
    lng: 77.209,
    locationName: "Sector 7, Delhi",
    extractedEntities: { locations: ["Sector 7"], hazards: ["fire"], people: [], vehicles: [], organizations: [] },
    agentHistory: [],
    auditTrail: [],
    metadata: null,
    tags: ["fire", "urgent"],
    reporterId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function createMockRepo(): IIncidentRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addMedia: vi.fn(),
    createReporter: vi.fn(),
    findReporterById: vi.fn(),
    logAgentExecution: vi.fn(),
  };
}

describe("SharedIncidentMemory", () => {
  let mockRepo: IIncidentRepository;
  let memory: SharedIncidentMemory;

  beforeEach(() => {
    mockRepo = createMockRepo();
    memory = new SharedIncidentMemory(mockRepo);
  });

  describe("read", () => {
    it("reads incident from repository", async () => {
      const incident = createMockIncident();
      vi.mocked(mockRepo.findById).mockResolvedValue(incident);

      const result = await memory.read("INC-1000");
      expect(result).toEqual(incident);
      expect(mockRepo.findById).toHaveBeenCalledWith("INC-1000");
    });

    it("returns null for non-existent incident", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);

      const result = await memory.read("INC-9999");
      expect(result).toBeNull();
    });
  });

  describe("write", () => {
    it("appends agent execution record and calls update + logAgentExecution", async () => {
      const incident = createMockIncident();
      const updatedIncident = createMockIncident({ version: 2 });

      vi.mocked(mockRepo.findById).mockResolvedValue(incident);
      vi.mocked(mockRepo.update).mockResolvedValue(updatedIncident);
      vi.mocked(mockRepo.logAgentExecution).mockResolvedValue(undefined);

      const result = await memory.write("INC-1000", "risk-evaluator", {
        status: "success",
        confidence: 0.88,
        reasoning: "Risk assessed as high based on proximity to residential area.",
        outputData: { riskLevel: "high" },
      });

      expect(result).toEqual(updatedIncident);
      expect(mockRepo.update).toHaveBeenCalledWith(
        "INC-1000",
        expect.objectContaining({
          agentHistory: expect.arrayContaining([
            expect.objectContaining({
              agentName: "risk-evaluator",
              status: "success",
              confidence: 0.88,
            }),
          ]),
        }),
        "agent:risk-evaluator",
        "agent_enrichment:risk-evaluator"
      );
      expect(mockRepo.logAgentExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: "risk-evaluator",
          incidentId: "INC-1000",
          status: "success",
        })
      );
    });

    it("throws if incident not found", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);

      await expect(
        memory.write("INC-9999", "test-agent", {
          status: "success",
          confidence: 0.5,
          reasoning: "test",
          outputData: {},
        })
      ).rejects.toThrow("SharedMemory: Incident INC-9999 not found");
    });
  });

  describe("getAgentChain", () => {
    it("returns sorted agent history", async () => {
      const incident = createMockIncident({
        agentHistory: [
          { agentName: "agent-b", status: "success", confidence: 0.8, reasoning: "B ran second", outputData: {}, timestamp: new Date("2026-01-01T01:00:00Z") },
          { agentName: "agent-a", status: "success", confidence: 0.9, reasoning: "A ran first", outputData: {}, timestamp: new Date("2026-01-01T00:00:00Z") },
        ],
      });
      vi.mocked(mockRepo.findById).mockResolvedValue(incident);

      const chain = await memory.getAgentChain("INC-1000");
      expect(chain).toHaveLength(2);
      expect(chain[0].agentName).toBe("agent-a");
      expect(chain[1].agentName).toBe("agent-b");
    });

    it("returns empty array if incident not found", async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);
      const chain = await memory.getAgentChain("INC-9999");
      expect(chain).toEqual([]);
    });
  });

  describe("getLatestAgentOutput", () => {
    it("returns the latest output from a specific agent", async () => {
      const incident = createMockIncident({
        agentHistory: [
          { agentName: "data-dispatcher", status: "success", confidence: 0.9, reasoning: "First run", outputData: { v: 1 }, timestamp: new Date("2026-01-01T00:00:00Z") },
          { agentName: "risk-evaluator", status: "success", confidence: 0.85, reasoning: "Risk check", outputData: { risk: "high" }, timestamp: new Date("2026-01-01T01:00:00Z") },
          { agentName: "data-dispatcher", status: "success", confidence: 0.95, reasoning: "Re-run with enrichment", outputData: { v: 2 }, timestamp: new Date("2026-01-01T02:00:00Z") },
        ],
      });
      vi.mocked(mockRepo.findById).mockResolvedValue(incident);

      const latest = await memory.getLatestAgentOutput("INC-1000", "data-dispatcher");
      expect(latest).not.toBeNull();
      expect(latest!.outputData).toEqual({ v: 2 });
    });

    it("returns null if agent has no executions", async () => {
      const incident = createMockIncident({ agentHistory: [] });
      vi.mocked(mockRepo.findById).mockResolvedValue(incident);

      const latest = await memory.getLatestAgentOutput("INC-1000", "unknown-agent");
      expect(latest).toBeNull();
    });
  });
});
