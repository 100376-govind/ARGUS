import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { protocolZeroService } from "@/application/agents/risk-evaluator/protocol-zero-service";
import { protocolZeroRepository } from "@/infrastructure/database/protocol-zero-repository";
import { RiskAssessmentRepository } from "@/infrastructure/database/risk-assessment-repository";
import { RequestValidator } from "../middleware/validation.middleware";
import { StandardResponse } from "../responses/standard-response";
import { AuthenticationHooks } from "../middleware/auth.hooks";
import { IncidentNotFoundError } from "@/shared/errors/risk-evaluator-service-errors";
import { prisma } from "@/infrastructure/database/prisma-client";


const initiateSchema = z.object({
  protocolZeroRequestId: z.string().uuid("Invalid Protocol Zero Request UUID"),
  commanderId: z.string().optional(),
});

const decisionSchema = z.object({
  approvalRequestId: z.string().uuid("Invalid Approval Request UUID"),
  justification: z.string().min(5, "Justification must be at least 5 characters long"),
});

const modifySchema = z.object({
  approvalRequestId: z.string().uuid("Invalid Approval Request UUID"),
  justification: z.string().min(5, "Justification must be at least 5 characters long"),
  modifications: z.object({
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    reasoning: z.string().min(5).optional(),
  }),
});

const paramsSchema = z.object({
  incidentId: z.string().min(1, "Incident ID is required"),
});

export class ProtocolZeroController {
  private readonly p0Repo = protocolZeroRepository;
  private readonly riskRepo = new RiskAssessmentRepository();

  /**
   * POST /api/protocol-zero/request
   */
  public async initiate(req: NextRequest): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    // Dispatchers or admins can escalate/initiate the review flow
    AuthenticationHooks.authorize(user, ["Dispatcher", "Admin", "Commander"]);

    const body = await RequestValidator.validateBody(req, initiateSchema);
    const result = await protocolZeroService.initiateApprovalRequest(
      body.protocolZeroRequestId,
      body.commanderId || user.userId
    );

    return StandardResponse.success(result, "Protocol Zero approval requested successfully", 201);
  }

  /**
   * POST /api/protocol-zero/approve
   */
  public async approve(req: NextRequest): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    // Decisions require Commander or Admin roles
    AuthenticationHooks.authorize(user, ["Commander", "Admin"]);

    const body = await RequestValidator.validateBody(req, decisionSchema);
    const result = await protocolZeroService.grantApproval(
      body.approvalRequestId,
      user.userId,
      body.justification
    );

    return StandardResponse.success(result, "Protocol Zero authorization GRANTED successfully");
  }

  /**
   * POST /api/protocol-zero/reject
   */
  public async reject(req: NextRequest): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    AuthenticationHooks.authorize(user, ["Commander", "Admin"]);

    const body = await RequestValidator.validateBody(req, decisionSchema);
    const result = await protocolZeroService.rejectApproval(
      body.approvalRequestId,
      user.userId,
      body.justification
    );

    return StandardResponse.success(result, "Protocol Zero authorization REJECTED successfully");
  }

  /**
   * PATCH /api/protocol-zero/modify
   */
  public async modify(req: NextRequest): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    AuthenticationHooks.authorize(user, ["Commander", "Admin"]);

    const body = await RequestValidator.validateBody(req, modifySchema);
    const result = await protocolZeroService.modifyApproval(
      body.approvalRequestId,
      user.userId,
      body.justification,
      body.modifications as any
    );

    return StandardResponse.success(result, "Protocol Zero variables updated and AUTHORIZED");
  }

  /**
   * GET /api/protocol-zero/history/:incidentId
   */
  public async getHistory(req: NextRequest, context: any): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    // Viewers, Dispatchers, Commanders and Admins can query history
    AuthenticationHooks.authorize(user, ["Commander", "Dispatcher", "Admin"]);

    const params = RequestValidator.validateParams(context, paramsSchema);

    const assessment = await this.riskRepo.findByIncidentId(params.incidentId);
    if (!assessment) {
      throw new IncidentNotFoundError(params.incidentId);
    }

    // Find linked ProtocolZeroRequest
    const p0Reqs = await prisma.protocolZeroRequest.findMany({
      where: { riskAssessmentId: assessment.id },
      include: {
        approvalRequests: {
          include: {
            approvalDecisions: true,
            approvalHistories: true,
            escalationHistories: true,
          },
        },
      },
    });

    return StandardResponse.success(p0Reqs, "Protocol Zero approval history retrieved successfully");
  }
}

export const protocolZeroController = new ProtocolZeroController();
