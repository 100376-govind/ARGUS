import { describe, it, expect, vi, beforeEach } from "vitest";
import { protocolZeroService } from "@/application/agents/risk-evaluator/protocol-zero-service";
import { protocolZeroWorkflowProcessor } from "@/application/agents/risk-evaluator/protocol-zero-workflow";
import { prisma } from "@/infrastructure/database/prisma-client";
import { eventPublisher } from "@/infrastructure/events/event-publisher";
import { socketGateway } from "@/infrastructure/sockets/socket-gateway";
import { IncidentNotFoundError } from "@/shared/errors/risk-evaluator-service-errors";

vi.mock("@/infrastructure/logger/pino", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/infrastructure/events/event-publisher", () => ({
  eventPublisher: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/infrastructure/database/prisma-client", () => {
  return {
    prisma: {
      $transaction: vi.fn(),
      protocolZeroRequest: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      approvalRequest: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      approvalDecision: {
        create: vi.fn(),
      },
      commanderOverride: {
        create: vi.fn(),
      },
      approvalHistory: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      escalationHistory: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      riskAssessment: {
        update: vi.fn(),
      },
    },
  };
});

describe("Protocol Zero Approval Workflow Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully initiate a Protocol Zero approval request", async () => {
    const mockP0Request = {
      id: "p0-req-id",
      riskAssessmentId: "ra-id",
      reason: "Critical chemical plume",
      riskAssessment: {
        incidentId: "INC-99",
      },
    };

    const mockApprovalRequest = {
      id: "approval-req-id",
      protocolZeroRequestId: "p0-req-id",
      status: "pending",
      timeoutAt: new Date(),
    };

    vi.mocked(prisma.protocolZeroRequest.findUnique).mockResolvedValueOnce(mockP0Request as any);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
      return callback(prisma);
    });

    // Mock repository create methods internally
    protocolZeroService["p0Repo"].createApprovalRequest = vi.fn().mockResolvedValueOnce(mockApprovalRequest);
    protocolZeroService["p0Repo"].createApprovalHistory = vi.fn().mockResolvedValueOnce({});

    const result = await protocolZeroService.initiateApprovalRequest("p0-req-id", "commander-1");

    expect(result.id).toBe("approval-req-id");
    expect(prisma.protocolZeroRequest.findUnique).toHaveBeenCalledWith({
      where: { id: "p0-req-id" },
      include: { riskAssessment: true },
    });
    expect(protocolZeroService["p0Repo"].createApprovalRequest).toHaveBeenCalled();
  });

  it("should grant commander authorization successfully", async () => {
    const mockRequest = {
      id: "approval-req-id",
      protocolZeroRequestId: "p0-req-id",
      status: "pending",
      timeoutAt: new Date(Date.now() + 60000), // active
      protocolZeroRequest: {
        riskAssessmentId: "ra-id",
        riskAssessment: {
          incidentId: "INC-99",
        },
      },
    };

    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
      return callback(prisma);
    });

    protocolZeroService["p0Repo"].getApprovalRequestById = vi.fn().mockResolvedValueOnce(mockRequest);
    protocolZeroService["p0Repo"].updateApprovalRequestStatus = vi.fn().mockResolvedValueOnce({
      ...mockRequest,
      status: "approved",
    });
    protocolZeroService["p0Repo"].createApprovalDecision = vi.fn();
    protocolZeroService["p0Repo"].createApprovalHistory = vi.fn();
    protocolZeroService["sharedMemory"].read = vi.fn().mockResolvedValueOnce({ id: "INC-99" });
    protocolZeroService["sharedMemory"].write = vi.fn();

    const result = await protocolZeroService.grantApproval("approval-req-id", "commander-1", "Authorized tactical deployment");

    expect(result.status).toBe("approved");
    expect(prisma.protocolZeroRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "p0-req-id" },
      data: expect.objectContaining({ status: "approved" }),
    }));
    expect(prisma.riskAssessment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ra-id" },
      data: expect.objectContaining({ isProtocolZeroTriggered: true }),
    }));
  });

  it("should reject commander request successfully", async () => {
    const mockRequest = {
      id: "approval-req-id",
      protocolZeroRequestId: "p0-req-id",
      status: "pending",
      timeoutAt: new Date(Date.now() + 60000),
      protocolZeroRequest: {
        riskAssessmentId: "ra-id",
        riskAssessment: {
          incidentId: "INC-99",
        },
      },
    };

    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
      return callback(prisma);
    });

    protocolZeroService["p0Repo"].getApprovalRequestById = vi.fn().mockResolvedValueOnce(mockRequest);
    protocolZeroService["p0Repo"].updateApprovalRequestStatus = vi.fn().mockResolvedValueOnce({
      ...mockRequest,
      status: "rejected",
    });
    protocolZeroService["p0Repo"].createApprovalDecision = vi.fn();
    protocolZeroService["p0Repo"].createApprovalHistory = vi.fn();
    protocolZeroService["sharedMemory"].read = vi.fn().mockResolvedValueOnce({ id: "INC-99" });
    protocolZeroService["sharedMemory"].write = vi.fn();

    const result = await protocolZeroService.rejectApproval("approval-req-id", "commander-1", "Stand down order");

    expect(result.status).toBe("rejected");
    expect(prisma.riskAssessment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ra-id" },
      data: expect.objectContaining({ isProtocolZeroTriggered: false }),
    }));
  });

  it("should escalate pending requests automatically on timeout cycle", async () => {
    const mockActiveRequests = [
      {
        id: "approval-req-1",
        protocolZeroRequestId: "p0-1",
        status: "pending",
        timeoutAt: new Date(Date.now() - 5000), // expired 5 seconds ago
        protocolZeroRequest: {
          riskAssessment: {
            incidentId: "INC-1",
          },
        },
        approvalHistories: [],
      },
    ];

    vi.mocked(prisma.approvalRequest.findMany).mockResolvedValueOnce(mockActiveRequests as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback(prisma);
    });

    protocolZeroWorkflowProcessor["p0Repo"].createEscalationHistory = vi.fn();
    protocolZeroWorkflowProcessor["p0Repo"].createApprovalHistory = vi.fn();

    await protocolZeroWorkflowProcessor.processPendingTimeouts();

    expect(prisma.approvalRequest.findMany).toHaveBeenCalled();
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "approval-req-1" },
      data: expect.objectContaining({ status: "escalated" }),
    }));
    expect(protocolZeroWorkflowProcessor["p0Repo"].createEscalationHistory).toHaveBeenCalled();
  });
});
