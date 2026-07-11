import { describe, it, expect, vi, beforeEach } from "vitest";
import { IncidentEntity } from "@/domain/entities/incident";

// Mock out GoogleGenAI client to avoid external hits
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              sitrep: "Crisis Situation Stabilized",
              incidentSummary: "Hazardous fire in residential zone",
              decisionSummary: "Resources successfully deployed",
              complianceStatus: "All pipelines complied",
              recommendations: ["Perform regular maintenance checks"],
            }),
          }),
        },
      };
    }),
  };
});

// Mock SocketGateway and eventBus
vi.mock("@/infrastructure/sockets/socket-gateway", () => {
  return {
    socketGateway: {
      broadcastAuditStarted: vi.fn(),
      broadcastTimelineUpdated: vi.fn(),
      broadcastReportGenerated: vi.fn(),
      broadcastComplianceChecked: vi.fn(),
      broadcastPdfGenerated: vi.fn(),
      broadcastDashboardUpdated: vi.fn(),
    },
  };
});

vi.mock("@/infrastructure/redis/redis-event-bus", () => {
  return {
    eventBus: {
      publish: vi.fn(),
    },
  };
});

// Mock Prisma incident repo
vi.mock("@/infrastructure/database/prisma-incident-repository", () => {
  const localMockIncident = {
    id: "INC-5000",
    version: 1,
    status: "dispatched",
    source: "webhook",
    incidentType: "hazmat",
    rawContent: "chemical spill",
    structuredDesc: "chemical spill",
    confidence: 0.9,
    lat: 0,
    lng: 0,
    locationName: "Test Site",
    extractedEntities: { locations: [], hazards: [], people: [], vehicles: [], organizations: [] },
    agentHistory: [],
    auditTrail: [],
    metadata: {
      sitrep: "Crisis Situation Stabilized",
      incidentSummary: "Hazardous fire in residential zone",
      decisionSummary: "Resources successfully deployed",
      complianceStatus: "Complete",
      recommendations: ["Perform regular maintenance checks"],
      timeline: [
        {
          id: "te-1",
          stage: "received",
          action: "Incident Received",
          description: "Logged successfully",
          timestamp: new Date(),
          agentName: "data-dispatcher",
        },
        {
          id: "te-2",
          stage: "evaluated",
          action: "Priority Assigned",
          description: "Priority assigned",
          timestamp: new Date(),
          agentName: "risk-evaluator",
        },
        {
          id: "te-3",
          stage: "validated",
          action: "Validation Completed",
          description: "Incident validated",
          timestamp: new Date(),
          agentName: "field-validator",
        },
        {
          id: "te-4",
          stage: "allocated",
          action: "Resources Allocated",
          description: "Resources allocated",
          timestamp: new Date(),
          agentName: "resource-allocator",
        },
      ],
    },
    tags: [],
    reporterId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    PrismaIncidentRepository: vi.fn().mockImplementation(() => {
      return {
        findById: vi.fn().mockResolvedValue(localMockIncident),
        update: vi.fn().mockResolvedValue(localMockIncident),
      };
    }),
  };
});

import { PDFExportService } from "../services/pdf-export.service";
import { ComplianceController } from "@/presentation/controllers/compliance.controller";
import { socketGateway } from "@/infrastructure/sockets/socket-gateway";
import { eventBus } from "@/infrastructure/redis/redis-event-bus";
import { NextRequest } from "next/server";

const mockIncident: IncidentEntity = {
  id: "INC-5000",
  version: 1,
  status: "dispatched",
  source: "webhook",
  incidentType: "hazmat",
  rawContent: "chemical spill",
  structuredDesc: "chemical spill",
  confidence: 0.9,
  lat: 0,
  lng: 0,
  locationName: "Test Site",
  extractedEntities: { locations: [], hazards: [], people: [], vehicles: [], organizations: [] },
  agentHistory: [],
  auditTrail: [],
  metadata: {
    sitrep: "Crisis Situation Stabilized",
    incidentSummary: "Hazardous fire in residential zone",
    decisionSummary: "Resources successfully deployed",
    complianceStatus: "Complete",
    recommendations: ["Perform regular maintenance checks"],
    timeline: [
      {
        id: "te-1",
        stage: "received",
        action: "Incident Received",
        description: "Logged successfully",
        timestamp: new Date(),
        agentName: "data-dispatcher",
      },
      {
        id: "te-2",
        stage: "evaluated",
        action: "Priority Assigned",
        description: "Priority assigned",
        timestamp: new Date(),
        agentName: "risk-evaluator",
      },
      {
        id: "te-3",
        stage: "validated",
        action: "Validation Completed",
        description: "Incident validated",
        timestamp: new Date(),
        agentName: "field-validator",
      },
      {
        id: "te-4",
        stage: "allocated",
        action: "Resources Allocated",
        description: "Resources allocated",
        timestamp: new Date(),
        agentName: "resource-allocator",
      },
    ],
  },
  tags: [],
  reporterId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Compliance Auditor - Phase 5.45 Expose Layers", () => {
  let controller: ComplianceController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ComplianceController();
  });

  it("should generate a downloadable PDF with valid signature header", async () => {
    const pdfBuffer = await PDFExportService.exportIncidentAuditPDF(mockIncident, mockIncident.metadata);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    
    const signature = pdfBuffer.toString("utf8", 0, 4);
    expect(signature).toBe("%PDF");
  });

  it("should trigger REST endpoints, invoke Redis event publishing, and Socket broadcasts", async () => {
    const req = new NextRequest("http://localhost:3000/api/compliance/INC-5000");

    const res = await controller.getComplianceSummary(req, { params: { incidentId: "INC-5000" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.complianceStatus).toBe("Complete");

    // Verify Redis publishes occurred
    expect(eventBus.publish).toHaveBeenCalledWith("AuditStarted", expect.any(Object));
    expect(eventBus.publish).toHaveBeenCalledWith("ComplianceCompleted", expect.any(Object));

    // Verify Socket broadcasts occurred
    expect(socketGateway.broadcastAuditStarted).toHaveBeenCalledWith("INC-5000");
    expect(socketGateway.broadcastComplianceChecked).toHaveBeenCalledWith("INC-5000", "Complete");
  });

  it("should retrieve the sorted chronological timeline from endpoint", async () => {
    const req = new NextRequest("http://localhost:3000/api/compliance/timeline/INC-5000");

    const res = await controller.getTimeline(req, { params: { incidentId: "INC-5000" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.events).toHaveLength(4);
    expect(socketGateway.broadcastTimelineUpdated).toHaveBeenCalled();
  });

  it("should retrieve the summary audit report from endpoint", async () => {
    const req = new NextRequest("http://localhost:3000/api/compliance/report/INC-5000");

    const res = await controller.getReport(req, { params: { incidentId: "INC-5000" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.sitrep).toBe("Crisis Situation Stabilized");
  });
});
