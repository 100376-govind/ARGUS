import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { riskEvaluationService } from "@/application/agents/risk-evaluator/risk-evaluation-service";
import {
  RiskAssessmentRepository,
  SeverityRepository,
  PriorityRepository,
} from "@/infrastructure/database/risk-assessment-repository";
import { RequestValidator } from "../middleware/validation.middleware";
import { StandardResponse } from "../responses/standard-response";
import { AuthenticationHooks } from "../middleware/auth.hooks";
import { IncidentNotFoundError } from "@/shared/errors/risk-evaluator-service-errors";
import { prisma } from "@/infrastructure/database/prisma-client";
import { SeverityLevel, PriorityLevel } from "@/domain/entities/risk-evaluator";

const evaluateSchema = z.object({
  incidentId: z.string().min(1, "Incident ID is required"),
});

const patchSchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  reasoning: z.string().min(1).optional(),
  isProtocolZeroTriggered: z.boolean().optional(),
});

const paramsSchema = z.object({
  incidentId: z.string().min(1, "Incident ID is required"),
});

export class RiskController {
  private readonly riskRepo: RiskAssessmentRepository;
  private readonly severityRepo: SeverityRepository;
  private readonly priorityRepo: PriorityRepository;

  constructor() {
    this.riskRepo = new RiskAssessmentRepository();
    this.severityRepo = new SeverityRepository();
    this.priorityRepo = new PriorityRepository();
  }

  /**
   * POST /api/risk/evaluate
   */
  public async evaluate(req: NextRequest): Promise<NextResponse> {
    // 1. Authentication Check (Dispatcher / Commander / Admin)
    const user = await AuthenticationHooks.authenticate(req);
    AuthenticationHooks.authorize(user, ["Dispatcher", "Commander", "Admin"]);

    // 2. Request body DTO validation
    const body = await RequestValidator.validateBody(req, evaluateSchema);

    // 3. Call Service Layer
    const assessment = await riskEvaluationService.evaluateIncidentRisk(body.incidentId);

    // 4. Return standard response
    return StandardResponse.success(assessment, "Incident evaluated successfully", 201);
  }

  /**
   * GET /api/risk/:incidentId
   */
  public async getByIncidentId(req: NextRequest, context: any): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    AuthenticationHooks.authorize(user, ["Dispatcher", "Commander", "Admin"]);

    const params = RequestValidator.validateParams(context, paramsSchema);

    const assessment = await this.riskRepo.findByIncidentId(params.incidentId);
    if (!assessment) {
      throw new IncidentNotFoundError(params.incidentId);
    }

    return StandardResponse.success(assessment, "Risk assessment retrieved successfully");
  }

  /**
   * GET /api/risk/history/:incidentId
   */
  public async getHistoryByIncidentId(req: NextRequest, context: any): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    AuthenticationHooks.authorize(user, ["Dispatcher", "Commander", "Admin"]);

    const params = RequestValidator.validateParams(context, paramsSchema);

    const assessment = await this.riskRepo.findByIncidentId(params.incidentId);
    if (!assessment) {
      throw new IncidentNotFoundError(params.incidentId);
    }

    const severityHistory = await this.severityRepo.findByAssessmentId(assessment.id);
    const priorityHistory = await this.priorityRepo.findByAssessmentId(assessment.id);

    const historyPayload = {
      assessmentId: assessment.id,
      incidentId: assessment.incidentId,
      severityHistory,
      priorityHistory,
    };

    return StandardResponse.success(historyPayload, "Risk assessment history logs retrieved successfully");
  }

  /**
   * PATCH /api/risk/:incidentId
   */
  public async update(req: NextRequest, context: any): Promise<NextResponse> {
    // Requires Commander or Admin authority to overwrite risk levels
    const user = await AuthenticationHooks.authenticate(req);
    AuthenticationHooks.authorize(user, ["Commander", "Admin"]);

    const params = RequestValidator.validateParams(context, paramsSchema);
    const body = await RequestValidator.validateBody(req, patchSchema);

    const assessment = await this.riskRepo.findByIncidentId(params.incidentId);
    if (!assessment) {
      throw new IncidentNotFoundError(params.incidentId);
    }

    // Wrap the updates and history logging in database transaction
    const updatedAssessment = await prisma.$transaction(async (tx: any) => {
      const updated = await this.riskRepo.update(
        assessment.id,
        {
          severity: body.severity as SeverityLevel,
          priority: body.priority as PriorityLevel,
          reasoning: body.reasoning,
          isProtocolZeroTriggered: body.isProtocolZeroTriggered,
        },
        tx
      );

      if (body.severity) {
        await this.severityRepo.create(
          {
            riskAssessmentId: assessment.id,
            severity: body.severity as SeverityLevel,
            score: this.mapSeverityToScore(body.severity),
            reason: body.reasoning || "Manual severity adjustment by command personnel",
            changedBy: `user:${user.userId} (${user.role})`,
          },
          tx
        );
      }

      if (body.priority) {
        await this.priorityRepo.create(
          {
            riskAssessmentId: assessment.id,
            priority: body.priority as PriorityLevel,
            score: this.mapPriorityToScore(body.priority),
            reason: body.reasoning || "Manual priority adjustment by command personnel",
            changedBy: `user:${user.userId} (${user.role})`,
          },
          tx
        );
      }

      return updated;
    });

    return StandardResponse.success(updatedAssessment, "Risk assessment updated successfully");
  }

  /**
   * GET /api/risk/statistics
   */
  public async getStatistics(req: NextRequest): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    AuthenticationHooks.authorize(user, ["Commander", "Admin", "Dispatcher"]);

    const totalCount = await prisma.riskAssessment.count();

    const severityCounts = await prisma.riskAssessment.groupBy({
      by: ["severity"],
      _count: { severity: true },
    });

    const priorityCounts = await prisma.riskAssessment.groupBy({
      by: ["priority"],
      _count: { priority: true },
    });

    const protocolZeroCount = await prisma.riskAssessment.count({
      where: { isProtocolZeroTriggered: true },
    });

    const avgRiskScoreAgg = await prisma.riskAssessment.aggregate({
      _avg: { overallRiskScore: true },
    });

    const stats = {
      totalEvaluated: totalCount,
      averageRiskScore: avgRiskScoreAgg._avg.overallRiskScore || 0,
      protocolZeroTriggeredCount: protocolZeroCount,
      severityDistribution: severityCounts.reduce((acc: any, curr: any) => {
        acc[curr.severity] = curr._count.severity;
        return acc;
      }, {} as Record<string, number>),
      priorityDistribution: priorityCounts.reduce((acc: any, curr: any) => {
        acc[curr.priority] = curr._count.priority;
        return acc;
      }, {} as Record<string, number>),
    };

    return StandardResponse.success(stats, "Evaluator statistics retrieved successfully");
  }

  private mapSeverityToScore(level: string): number {
    switch (level) {
      case "CRITICAL": return 90;
      case "HIGH": return 70;
      case "MEDIUM": return 40;
      default: return 15;
    }
  }

  private mapPriorityToScore(level: string): number {
    switch (level) {
      case "CRITICAL": return 90;
      case "HIGH": return 70;
      case "MEDIUM": return 40;
      default: return 15;
    }
  }
}

export const riskController = new RiskController();
