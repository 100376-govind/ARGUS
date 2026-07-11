import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComplianceValidator } from "../utils/compliance-validator";
import { GeminiPromptBuilder } from "../utils/gemini-prompt-builder";
import { GeminiReportService } from "../services/gemini-report.service";
import { ReportGenerationService } from "../services/report-generation.service";
import { TimelineEvent } from "../models/models";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { IncidentEntity } from "@/domain/entities/incident";

let callCount = 0;
const mockGenerateContent = vi.fn().mockImplementation(async () => {
  callCount++;
  if (callCount === 1) {
    // Malformed JSON output to test retry logic
    return { text: "malformed JSON {" };
  }
  return {
    text: JSON.stringify({
      sitrep: "Crisis Situation Stabilized",
      incidentSummary: "Hazardous fire in residential zone",
      decisionSummary: "Resources successfully deployed",
      complianceStatus: "All pipelines complied",
      recommendations: ["Perform regular maintenance checks"],
    }),
  };
});

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: mockGenerateContent,
        },
      };
    }),
  };
});

function createMockIncident(overrides?: Partial<IncidentEntity>): IncidentEntity {
  return {
    id: "INC-3000",
    version: 1,
    status: "dispatched",
    source: "webhook",
    incidentType: "fire",
    rawContent: "Warehouse fire",
    structuredDesc: "A large warehouse fire has been detected.",
    confidence: 0.98,
    lat: 12.9716,
    lng: 77.5946,
    locationName: "Bangalore",
    extractedEntities: { locations: [], hazards: [], people: [], vehicles: [], organizations: [] },
    agentHistory: [],
    auditTrail: [],
    metadata: {},
    tags: ["fire"],
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

describe("Compliance Auditor - ComplianceValidator", () => {
  it("should evaluate compliance status based on timeline correctly", () => {
    const timestamp = new Date();
    
    // 1. Complete timeline
    const completeEvents = [
      new TimelineEvent("te-1", "received", "Received", "desc", timestamp, "data-dispatcher"),
      new TimelineEvent("te-2", "evaluated", "Evaluated", "desc", timestamp, "risk-evaluator"),
      new TimelineEvent("te-3", "validated", "Validated", "desc", timestamp, "field-validator"),
      new TimelineEvent("te-4", "allocated", "Allocated", "desc", timestamp, "resource-allocator"),
    ];
    expect(ComplianceValidator.validateCompliance(completeEvents)).toBe("Complete");

    // 2. Incomplete timeline
    const incompleteEvents = [
      new TimelineEvent("te-1", "received", "Received", "desc", timestamp, "data-dispatcher"),
    ];
    expect(ComplianceValidator.validateCompliance(incompleteEvents)).toBe("Incomplete");

    // 3. Needs Review due to warnings/failures
    const failedEvents = [
      new TimelineEvent("te-1", "received", "Received", "desc", timestamp, "data-dispatcher"),
      new TimelineEvent("te-2", "evaluated", "Evaluated", "Execution failed", timestamp, "risk-evaluator"),
    ];
    expect(ComplianceValidator.validateCompliance(failedEvents)).toBe("Needs Review");
  });
});

describe("Compliance Auditor - GeminiReportService", () => {
  beforeEach(() => {
    callCount = 0;
    mockGenerateContent.mockClear();
  });

  it("should generate report, validate JSON, and retry on malformed responses", async () => {
    const service = new GeminiReportService("mock-key");
    const result = await service.generateReport("generate report prompt");

    expect(result.sitrep).toBe("Crisis Situation Stabilized");
    expect(mockGenerateContent).toHaveBeenCalledTimes(2); // 1st failed/malformed, 2nd succeeded
  });
});

describe("Compliance Auditor - ReportGenerationService Integration", () => {
  let mockRepo: IIncidentRepository;
  let service: ReportGenerationService;
  let localIncident: IncidentEntity;

  beforeEach(() => {
    callCount = 0;
    mockGenerateContent.mockClear();
    mockRepo = createMockRepo();
    service = new ReportGenerationService(mockRepo, "mock-key");

    localIncident = createMockIncident({
      metadata: {
        timeline: [
          new TimelineEvent("te-1", "received", "Incident Received", "Incident logged.", new Date(), "data-dispatcher"),
        ],
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

  it("should orchestrate report generation, run compliance check, and append data to shared memory", async () => {
    const report = await service.generateAuditReport("INC-3000");

    expect(report.sitrep).toBe("Crisis Situation Stabilized");
    expect(report.complianceStatus).toContain("System Status: Incomplete"); // Only received stage present
    expect(localIncident.metadata).toHaveProperty("sitrep");
    expect(localIncident.metadata).toHaveProperty("reportTimestamp");
    expect(mockRepo.update).toHaveBeenCalled();
  });
});
