import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { protocolZeroController } from "@/presentation/controllers/protocol-zero.controller";
import { protocolZeroService } from "@/application/agents/risk-evaluator/protocol-zero-service";
import { AuthenticationHooks } from "@/presentation/middleware/auth.hooks";
import { AppError } from "@/shared/errors/app-error";
import { prisma } from "@/infrastructure/database/prisma-client";

vi.mock("@/application/agents/risk-evaluator/protocol-zero-service", () => ({
  protocolZeroService: {
    initiateApprovalRequest: vi.fn(),
    grantApproval: vi.fn(),
    rejectApproval: vi.fn(),
    modifyApproval: vi.fn(),
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

vi.mock("@/infrastructure/database/prisma-client", () => {
  return {
    prisma: {
      protocolZeroRequest: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

describe("ProtocolZeroController Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (url: string, method: string, headers: Record<string, string>, body?: any) => {
    return new NextRequest(url, {
      method,
      headers: new Headers(headers),
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  it("should successfully trigger a Protocol Zero request for Dispatcher", async () => {
    const req = createRequest("http://localhost/api/protocol-zero/request", "POST", {
      "Authorization": "Bearer mock-dispatcher-token",
    }, {
      protocolZeroRequestId: "d70c4bdc-2234-4a4a-8742-83b6cb59be83",
    });

    vi.mocked(protocolZeroService.initiateApprovalRequest).mockResolvedValueOnce({
      id: "approval-1",
      status: "pending",
    });

    const response = await protocolZeroController.initiate(req);
    expect(response.status).toBe(201);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("pending");
  });

  it("should block grant approval for Dispatchers (RBAC restriction)", async () => {
    const req = createRequest("http://localhost/api/protocol-zero/approve", "POST", {
      "Authorization": "Bearer mock-dispatcher-token",
    }, {
      approvalRequestId: "d70c4bdc-2234-4a4a-8742-83b6cb59be83",
      justification: "Allow trigger",
    });

    await expect(protocolZeroController.approve(req)).rejects.toThrow(AppError);
  });

  it("should allow Commanders to approve authorization requests", async () => {
    const req = createRequest("http://localhost/api/protocol-zero/approve", "POST", {
      "Authorization": "Bearer mock-commander-token",
    }, {
      approvalRequestId: "d70c4bdc-2234-4a4a-8742-83b6cb59be83",
      justification: "Critical crisis override deployment",
    });

    vi.mocked(protocolZeroService.grantApproval).mockResolvedValueOnce({
      id: "approval-1",
      status: "approved",
    });

    const response = await protocolZeroController.approve(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("approved");
  });

  it("should allow Commanders to modify and save requests", async () => {
    const req = createRequest("http://localhost/api/protocol-zero/modify", "PATCH", {
      "Authorization": "Bearer mock-commander-token",
    }, {
      approvalRequestId: "d70c4bdc-2234-4a4a-8742-83b6cb59be83",
      justification: "Reducing priority level slightly",
      modifications: {
        severity: "CRITICAL",
        priority: "HIGH",
      },
    });

    vi.mocked(protocolZeroService.modifyApproval).mockResolvedValueOnce({
      id: "approval-1",
      status: "modified",
    });

    const response = await protocolZeroController.modify(req);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it("should get approval histories log cleanly", async () => {
    const req = createRequest("http://localhost/api/protocol-zero/history/INC-100", "GET", {
      "Authorization": "Bearer mock-commander-token",
    });

    protocolZeroController["riskRepo"].findByIncidentId = vi.fn().mockResolvedValueOnce({ id: "ra-1" });
    vi.mocked(prisma.protocolZeroRequest.findMany).mockResolvedValueOnce([
      { id: "p0-1", status: "approved" },
    ] as any);

    const response = await protocolZeroController.getHistory(req, { params: { incidentId: "INC-100" } });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.data).toHaveLength(1);
  });
});
