import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditEvent, TimelineEvent, IncidentTimeline, ActionLog, AuditMetadata, AuditRecord } from "../models/models";
import { TimelineBuilder } from "../utils/timeline-builder";
import { ComplianceAuditorService } from "../services/compliance-auditor.service";
import { SharedMemoryIntegration } from "../services/shared-memory-integration";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { IncidentEntity } from "@/domain/entities/incident";

// Mock Incident factory
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

// Mock Repository factory
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

describe("Compliance Auditor - Models", () => {
  it("should instantiate models correctly", () => {
    const timestamp = new Date();
    const event = new AuditEvent("evt-1", "INC-1000", "test-agent", timestamp, "success", { foo: "bar" });
    const timelineEvent = new TimelineEvent("te-1", "received", "Received", "desc", timestamp, "test-agent");
    const timeline = new IncidentTimeline("INC-1000", [timelineEvent]);
    const actionLog = new ActionLog("al-1", "create", "actor", timestamp, { hello: "world" });
    const meta = new AuditMetadata(100, true, timestamp);
    const record = new AuditRecord("INC-1000", [event], timeline, [actionLog], meta, timestamp, timestamp);

    expect(event.id).toBe("evt-1");
    expect(timelineEvent.stage).toBe("received");
    expect(timeline.events).toHaveLength(1);
    expect(actionLog.action).toBe("create");
    expect(meta.complianceScore).toBe(100);
    expect(record.incidentId).toBe("INC-1000");
  });
});

describe("Compliance Auditor - Timeline Builder", () => {
  it("should build timeline chronologically from incident history", () => {
    const incident = createMockIncident({
      createdAt: new Date("2026-01-01T00:00:00Z"),
      agentHistory: [
        {
          agentName: "risk-evaluator",
          status: "success",
          confidence: 0.9,
          reasoning: "evaluated",
          outputData: {},
          timestamp: new Date("2026-01-01T00:05:00Z"),
        },
        {
          agentName: "field-validator",
          status: "success",
          confidence: 0.95,
          reasoning: "validated",
          outputData: {},
          timestamp: new Date("2026-01-01T00:10:00Z"),
        },
      ],
    });

    const timeline = TimelineBuilder.buildTimeline(incident);
    expect(timeline.incidentId).toBe("INC-1000");
    expect(timeline.events).toHaveLength(3);
    expect(timeline.events[0].stage).toBe("received");
    expect(timeline.events[1].stage).toBe("evaluated");
    expect(timeline.events[2].stage).toBe("validated");
  });
});

describe("Compliance Auditor - Shared Memory Integration", () => {
  let mockRepo: IIncidentRepository;
  let sharedMemoryIntegration: SharedMemoryIntegration;

  beforeEach(() => {
    mockRepo = createMockRepo();
    sharedMemoryIntegration = new SharedMemoryIntegration(mockRepo);
  });

  it("should append compliance data to incident metadata without overwriting previous data", async () => {
    const incident = createMockIncident({
      metadata: { existingKey: "existingValue" },
    });
    vi.mocked(mockRepo.findById).mockResolvedValue(incident);

    const auditEvent = new AuditEvent("evt-1", "INC-1000", "test", new Date(), "success", {});
    await sharedMemoryIntegration.appendComplianceData("INC-1000", { auditRecord: auditEvent });

    expect(mockRepo.update).toHaveBeenCalledWith(
      "INC-1000",
      expect.objectContaining({
        metadata: expect.objectContaining({
          existingKey: "existingValue",
          auditRecords: expect.arrayContaining([expect.objectContaining({ id: "evt-1" })]),
        }),
      }),
      "agent:compliance-auditor",
      "compliance_audit_append"
    );
  });
});

describe("Compliance Auditor - Service", () => {
  let mockRepo: IIncidentRepository;
  let service: ComplianceAuditorService;
  let localIncident: IncidentEntity;

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new ComplianceAuditorService(mockRepo);

    localIncident = createMockIncident({
      metadata: {
        timeline: [],
        auditRecords: [],
        eventHistory: [],
      },
    });

    vi.mocked(mockRepo.findById).mockImplementation(async () => {
      return localIncident;
    });

    vi.mocked(mockRepo.update).mockImplementation(async (id, updates) => {
      localIncident = {
        ...localIncident,
        ...updates,
      };
      return localIncident;
    });
  });

  it("should create audit and initialize timeline events", async () => {
    const record = await service.createAudit("INC-1000");
    expect(record.incidentId).toBe("INC-1000");
    expect(record.timeline.events).toHaveLength(1);
    expect(mockRepo.update).toHaveBeenCalled();
  });

  it("should ingest agent output and calculate compliance score", async () => {
    // Ingest data-dispatcher output
    await service.ingestAgentOutput("INC-1000", "data-dispatcher", {
      status: "success",
    });

    // Ingest risk-evaluator output
    await service.ingestAgentOutput("INC-1000", "risk-evaluator", {
      status: "success",
      priority: "high",
    });

    // Retrieve audit report
    const auditReport = await service.getAudit("INC-1000");
    expect(auditReport).not.toBeNull();
    // 2 out of 4 stages met: 50% compliance
    expect(auditReport!.metadata.complianceScore).toBe(50);
    expect(auditReport!.metadata.isFullyCompliant).toBe(false);
  });
});



