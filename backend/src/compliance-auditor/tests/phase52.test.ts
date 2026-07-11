import { describe, it, expect, vi, beforeEach } from "vitest";
import { TimelineEvent } from "../models/models";
import { AuditStatusCalculator } from "../utils/audit-status-calculator";
import { TimelineSynchronizationService } from "../services/timeline-synchronization.service";
import { EventTrackingService } from "../services/event-tracking.service";
import { SharedMemoryIntegration } from "../services/shared-memory-integration";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { IncidentEntity } from "@/domain/entities/incident";

function createMockIncident(overrides?: Partial<IncidentEntity>): IncidentEntity {
  return {
    id: "INC-2000",
    version: 1,
    status: "pending",
    source: "text",
    incidentType: "hazmat",
    rawContent: "Chemical spill on highway",
    structuredDesc: "A chemical spill has occurred.",
    confidence: 0.95,
    lat: 22.5726,
    lng: 88.3639,
    locationName: "Kolkata",
    extractedEntities: { locations: [], hazards: [], people: [], vehicles: [], organizations: [] },
    agentHistory: [],
    auditTrail: [],
    metadata: {},
    tags: ["hazmat"],
    reporterId: null,
    createdAt: new Date("2026-01-01T12:00:00Z"),
    updatedAt: new Date("2026-01-01T12:00:00Z"),
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

describe("Compliance Auditor - AuditStatusCalculator", () => {
  it("should calculate status correctly", () => {
    expect(AuditStatusCalculator.calculateStatus([])).toBe("Started");
    
    expect(
      AuditStatusCalculator.calculateStatus([
        { stage: "received", status: "success" }
      ])
    ).toBe("Started");

    expect(
      AuditStatusCalculator.calculateStatus([
        { stage: "received", status: "success" },
        { stage: "evaluated", status: "success" }
      ])
    ).toBe("Processing");

    expect(
      AuditStatusCalculator.calculateStatus([
        { stage: "received", status: "success" },
        { stage: "evaluated", status: "success" },
        { stage: "validated", status: "success" },
        { stage: "allocated", status: "success" }
      ])
    ).toBe("Completed");

    expect(
      AuditStatusCalculator.calculateStatus([
        { stage: "received", status: "failed" }
      ])
    ).toBe("Failed");

    expect(
      AuditStatusCalculator.calculateStatus([
        { stage: "received", status: "cancelled" }
      ])
    ).toBe("Cancelled");
  });
});

describe("Compliance Auditor - TimelineSynchronizationService", () => {
  it("should sort events by timestamp and resolve concurrency using stage priorities", () => {
    const timestamp1 = new Date("2026-01-01T12:00:00Z");
    const timestamp2 = new Date("2026-01-01T12:05:00Z");

    const events: TimelineEvent[] = [
      new TimelineEvent("te-2", "evaluated", "Priority Assigned", "desc", timestamp1, "risk-evaluator"),
      new TimelineEvent("te-1", "received", "Incident Received", "desc", timestamp1, "data-dispatcher"),
      new TimelineEvent("te-3", "validated", "Validation Completed", "desc", timestamp2, "field-validator"),
    ];

    const synchronized = TimelineSynchronizationService.synchronizeTimeline(events);
    expect(synchronized).toHaveLength(3);
    // Same timestamp events are sorted: received (priority 1) comes before evaluated (priority 2)
    expect(synchronized[0].id).toBe("te-1");
    expect(synchronized[1].id).toBe("te-2");
    expect(synchronized[2].id).toBe("te-3");
  });
});

describe("Compliance Auditor - Phase 5.2 Integration", () => {
  let mockRepo: IIncidentRepository;
  let eventTrackingService: EventTrackingService;
  let localIncident: IncidentEntity;

  beforeEach(() => {
    mockRepo = createMockRepo();
    eventTrackingService = new EventTrackingService(mockRepo);

    localIncident = createMockIncident({
      metadata: {
        eventLog: [],
        timeline: [],
        auditStatus: "Started",
        executionHistory: [],
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

  it("should automatically track events, calculate status, and store execution history non-destructively", async () => {
    // 1. Track Incident Received
    await eventTrackingService.trackEvent("INC-2000", {
      agentName: "data-dispatcher",
      action: "Incident Received",
      timestamp: new Date("2026-01-01T12:00:00Z"),
      executionTime: 120,
      status: "success",
    });

    // 2. Track Priority Assigned
    await eventTrackingService.trackEvent("INC-2000", {
      agentName: "risk-evaluator",
      action: "Priority Assigned",
      timestamp: new Date("2026-01-01T12:01:00Z"),
      executionTime: 450,
      status: "success",
    });

    const meta = localIncident.metadata as any;
    expect(meta.eventLog).toHaveLength(2);
    expect(meta.timeline).toHaveLength(2);
    expect(meta.auditStatus).toBe("Processing"); // received + evaluated
    expect(meta.executionHistory).toHaveLength(2);
    expect(meta.executionHistory[0].agentName).toBe("data-dispatcher");
    expect(meta.executionHistory[1].executionTime).toBe(450);
  });

  it("should prevent duplicate event logs", async () => {
    const timestamp = new Date("2026-01-01T12:00:00Z");

    // Track once
    await eventTrackingService.trackEvent("INC-2000", {
      agentName: "data-dispatcher",
      action: "Incident Received",
      timestamp,
      executionTime: 100,
      status: "success",
    });

    // Track duplicate
    await eventTrackingService.trackEvent("INC-2000", {
      agentName: "data-dispatcher",
      action: "Incident Received",
      timestamp,
      executionTime: 100,
      status: "success",
    });

    const meta = localIncident.metadata as any;
    expect(meta.eventLog).toHaveLength(1);
  });
});
