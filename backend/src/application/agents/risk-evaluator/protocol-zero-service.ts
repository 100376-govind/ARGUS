import { prisma } from "@/infrastructure/database/prisma-client";
import { protocolZeroRepository } from "@/infrastructure/database/protocol-zero-repository";
import { RiskAssessmentRepository, SeverityRepository, PriorityRepository } from "@/infrastructure/database/risk-assessment-repository";
import { SharedIncidentMemoryIntegration } from "./shared-memory-integration";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { PrismaIncidentRepository } from "@/infrastructure/database/prisma-incident-repository";
import { eventPublisher } from "@/infrastructure/events/event-publisher";
import { socketGateway } from "@/infrastructure/sockets/socket-gateway";
import { logger } from "@/infrastructure/logger/pino";
import { DatabaseError, IncidentNotFoundError } from "@/shared/errors/risk-evaluator-service-errors";
import { SeverityLevel, PriorityLevel } from "@/domain/entities/risk-evaluator";

export class ProtocolZeroService {
  private readonly p0Repo = protocolZeroRepository;
  private readonly riskRepo = new RiskAssessmentRepository();
  private readonly severityRepo = new SeverityRepository();
  private readonly priorityRepo = new PriorityRepository();
  private readonly sharedMemoryIntegration: SharedIncidentMemoryIntegration;
  private readonly sharedMemory: SharedIncidentMemory;

  constructor() {
    const incidentRepo = new PrismaIncidentRepository();
    this.sharedMemory = new SharedIncidentMemory(incidentRepo);
    this.sharedMemoryIntegration = new SharedIncidentMemoryIntegration(this.sharedMemory);
  }

  /**
   * Reads an assessment and launches a Protocol Zero approval request.
   */
  public async initiateApprovalRequest(
    protocolZeroRequestId: string,
    commanderId?: string,
    timeoutMinutes: number = 15
  ): Promise<any> {
    const timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

    return await prisma.$transaction(async (tx: any) => {
      // 1. Fetch linked ProtocolZeroRequest
      const p0Req = await tx.protocolZeroRequest.findUnique({
        where: { id: protocolZeroRequestId },
        include: { riskAssessment: true },
      });

      if (!p0Req) {
        throw new Error(`ProtocolZeroRequest ${protocolZeroRequestId} not found`);
      }

      // 2. Create the ApprovalRequest record
      const approvalRequest = await this.p0Repo.createApprovalRequest(
        {
          protocolZeroRequestId,
          commanderId,
          timeoutAt,
          status: "pending",
        },
        tx
      );

      // 3. Log History action
      await this.p0Repo.createApprovalHistory(
        {
          approvalRequestId: approvalRequest.id,
          action: "created",
          actor: "system:risk-evaluator:protocol-zero-service",
          notes: `Protocol Zero approval initiated. Timeout set for Commander review by ${timeoutAt.toISOString()}`,
        },
        tx
      );

      // 4. Update ProtocolZeroRequest status to indicate review pending
      await tx.protocolZeroRequest.update({
        where: { id: protocolZeroRequestId },
        data: { status: "pending" },
      });

      // 5. Emit socket & redis events for notification
      const incidentId = p0Req.riskAssessment.incidentId;
      
      try {
        if (typeof socketGateway.initialize === "function") {
          // Socket Broadcast
          const riskNamespace = (socketGateway as any).io?.of("/risk");
          if (riskNamespace) {
            riskNamespace.emit("protocol_zero:approval_requested", {
              approvalRequestId: approvalRequest.id,
              incidentId,
              commanderId,
              timeoutAt: timeoutAt.toISOString(),
              reason: p0Req.reason,
            });
          }
        }

        // Redis Event Publish
        await eventPublisher.publish({
          eventId: `evt-${Math.random().toString(36).substring(2, 11)}`,
          eventType: "ProtocolZeroRecommended",
          timestamp: new Date().toISOString(),
          correlationId: `corr-${incidentId}`,
          data: {
            incidentId,
            assessmentId: p0Req.riskAssessmentId,
            reason: p0Req.reason,
          },
        } as any);
      } catch (err: any) {
        logger.warn({ err: err.message }, "ProtocolZeroService: Sockets connection warning during event emit");
      }

      logger.info({ approvalRequestId: approvalRequest.id, incidentId }, "Protocol Zero approval requested successfully");
      return approvalRequest;
    });
  }

  /**
   * Processes the approval decision.
   */
  public async grantApproval(approvalRequestId: string, commanderId: string, justification: string): Promise<any> {
    return await prisma.$transaction(async (tx: any) => {
      const request = await this.getValidatedRequest(approvalRequestId, tx);

      // Update ApprovalRequest status
      const updatedReq = await this.p0Repo.updateApprovalRequestStatus(approvalRequestId, "approved", tx);

      // Update ProtocolZeroRequest status
      await tx.protocolZeroRequest.update({
        where: { id: request.protocolZeroRequestId },
        data: {
          status: "approved",
          approvedBy: commanderId,
          actionedAt: new Date(),
        },
      });

      // Update RiskAssessment to indicate Protocol Zero triggered is locked in
      await tx.riskAssessment.update({
        where: { id: request.protocolZeroRequest.riskAssessmentId },
        data: { isProtocolZeroTriggered: true },
      });

      // Log Decision
      await this.p0Repo.createApprovalDecision(
        {
          approvalRequestId,
          commanderId,
          decision: "approved",
          justification,
        },
        tx
      );

      // Log History
      await this.p0Repo.createApprovalHistory(
        {
          approvalRequestId,
          action: "approved",
          actor: `commander:${commanderId}`,
          notes: justification,
        },
        tx
      );

      const incidentId = request.protocolZeroRequest.riskAssessment.incidentId;

      // Append to Shared Incident Memory
      await this.appendApprovalToSharedMemory(incidentId, "approved", commanderId, justification, tx);

      // Broadcast Events
      this.broadcastSocketAlert("protocol_zero:approval_granted", {
        approvalRequestId,
        incidentId,
        commanderId,
        justification,
      });

      logger.info({ approvalRequestId, incidentId }, "Protocol Zero: Approval request GRANTED");
      return updatedReq;
    });
  }

  /**
   * Processes the rejection decision.
   */
  public async rejectApproval(approvalRequestId: string, commanderId: string, justification: string): Promise<any> {
    return await prisma.$transaction(async (tx: any) => {
      const request = await this.getValidatedRequest(approvalRequestId, tx);

      // Update ApprovalRequest status
      const updatedReq = await this.p0Repo.updateApprovalRequestStatus(approvalRequestId, "rejected", tx);

      // Update ProtocolZeroRequest status
      await tx.protocolZeroRequest.update({
        where: { id: request.protocolZeroRequestId },
        data: {
          status: "rejected",
          approvedBy: commanderId,
          actionedAt: new Date(),
        },
      });

      // De-trigger Protocol Zero on RiskAssessment
      await tx.riskAssessment.update({
        where: { id: request.protocolZeroRequest.riskAssessmentId },
        data: { isProtocolZeroTriggered: false },
      });

      // Log Decision
      await this.p0Repo.createApprovalDecision(
        {
          approvalRequestId,
          commanderId,
          decision: "rejected",
          justification,
        },
        tx
      );

      // Log History
      await this.p0Repo.createApprovalHistory(
        {
          approvalRequestId,
          action: "rejected",
          actor: `commander:${commanderId}`,
          notes: justification,
        },
        tx
      );

      const incidentId = request.protocolZeroRequest.riskAssessment.incidentId;

      // Append to Shared Incident Memory
      await this.appendApprovalToSharedMemory(incidentId, "rejected", commanderId, justification, tx);

      // Broadcast Events
      this.broadcastSocketAlert("protocol_zero:approval_rejected", {
        approvalRequestId,
        incidentId,
        commanderId,
        justification,
      });

      logger.info({ approvalRequestId, incidentId }, "Protocol Zero: Approval request REJECTED");
      return updatedReq;
    });
  }

  /**
   * Modifies and approves parameters.
   */
  public async modifyApproval(
    approvalRequestId: string,
    commanderId: string,
    justification: string,
    modifications: { severity?: SeverityLevel; priority?: PriorityLevel; reasoning?: string }
  ): Promise<any> {
    return await prisma.$transaction(async (tx: any) => {
      const request = await this.getValidatedRequest(approvalRequestId, tx);
      const assessment = request.protocolZeroRequest.riskAssessment;

      // Update ApprovalRequest status
      const updatedReq = await this.p0Repo.updateApprovalRequestStatus(approvalRequestId, "modified", tx);

      // Update ProtocolZeroRequest status
      await tx.protocolZeroRequest.update({
        where: { id: request.protocolZeroRequestId },
        data: {
          status: "modified",
          approvedBy: commanderId,
          actionedAt: new Date(),
        },
      });

      // Apply modifications directly to RiskAssessment
      const updatedAssessment = await tx.riskAssessment.update({
        where: { id: assessment.id },
        data: {
          severity: modifications.severity || undefined,
          priority: modifications.priority || undefined,
          reasoning: modifications.reasoning || undefined,
          isProtocolZeroTriggered: true, // Still completes Protocol Zero execution path
        },
      });

      // Write parameters histories
      if (modifications.severity) {
        await this.severityRepo.create(
          {
            riskAssessmentId: assessment.id,
            severity: modifications.severity,
            score: modifications.severity === "CRITICAL" ? 90 : 70,
            reason: `Modified by Commander during Protocol Zero: ${justification}`,
            changedBy: `commander:${commanderId}`,
          },
          tx
        );
      }

      if (modifications.priority) {
        await this.priorityRepo.create(
          {
            riskAssessmentId: assessment.id,
            priority: modifications.priority,
            score: modifications.priority === "CRITICAL" ? 90 : 70,
            reason: `Modified by Commander during Protocol Zero: ${justification}`,
            changedBy: `commander:${commanderId}`,
          },
          tx
        );
      }

      // Log Commander Override audit log
      await this.p0Repo.createCommanderOverride(
        {
          riskAssessmentId: assessment.id,
          commanderId,
          reason: justification,
          overriddenSeverity: modifications.severity,
          overriddenPriority: modifications.priority,
        },
        tx
      );

      // Log Decision
      await this.p0Repo.createApprovalDecision(
        {
          approvalRequestId,
          commanderId,
          decision: "modified",
          justification,
          modificationPayload: modifications,
        },
        tx
      );

      // Log History
      await this.p0Repo.createApprovalHistory(
        {
          approvalRequestId,
          action: "modified",
          actor: `commander:${commanderId}`,
          notes: `Modified variables severity: ${modifications.severity || "unchanged"}, priority: ${modifications.priority || "unchanged"}. Justification: ${justification}`,
        },
        tx
      );

      const incidentId = assessment.incidentId;

      // Append to Shared Incident Memory
      await this.appendApprovalToSharedMemory(incidentId, "modified", commanderId, justification, tx);

      // Broadcast Events
      this.broadcastSocketAlert("protocol_zero:approval_modified", {
        approvalRequestId,
        incidentId,
        commanderId,
        justification,
        modifications,
      });

      logger.info({ approvalRequestId, incidentId }, "Protocol Zero: Approval request MODIFIED & SAVED");
      return updatedReq;
    });
  }

  /**
   * Escalates the request assignment to a higher authority level.
   */
  public async escalateRequest(
    approvalRequestId: string,
    currentCommanderId: string,
    nextCommanderId: string,
    reason: string
  ): Promise<any> {
    return await prisma.$transaction(async (tx: any) => {
      const request = await this.getValidatedRequest(approvalRequestId, tx);

      // Update ApprovalRequest status and assign new commander
      const updatedReq = await tx.approvalRequest.update({
        where: { id: approvalRequestId },
        data: {
          status: "escalated",
          commanderId: nextCommanderId,
          timeoutAt: new Date(Date.now() + 10 * 60 * 1000), // Reset with 10 mins extension
        },
      });

      // Record Escalation History
      await this.p0Repo.createEscalationHistory(
        {
          approvalRequestId,
          previousCommanderId: currentCommanderId,
          escalatedToCommanderId: nextCommanderId,
          reason,
        },
        tx
      );

      // Log History
      await this.p0Repo.createApprovalHistory(
        {
          approvalRequestId,
          action: "escalated",
          actor: `commander:${currentCommanderId}`,
          notes: `Escalated to Commander ${nextCommanderId}. Reason: ${reason}`,
        },
        tx
      );

      const incidentId = request.protocolZeroRequest.riskAssessment.incidentId;

      // Broadcast Events
      this.broadcastSocketAlert("protocol_zero:escalated", {
        approvalRequestId,
        incidentId,
        previousCommanderId: currentCommanderId,
        escalatedToCommanderId: nextCommanderId,
        reason,
      });

      logger.info(
        { approvalRequestId, incidentId, nextCommanderId },
        "Protocol Zero: Approval request escalated successfully"
      );
      return updatedReq;
    });
  }

  /**
   * Safety checks and validates requests.
   */
  private async getValidatedRequest(approvalRequestId: string, tx?: any): Promise<any> {
    const request = await this.p0Repo.getApprovalRequestById(approvalRequestId, tx);
    if (!request) {
      throw new IncidentNotFoundError(`ApprovalRequest ${approvalRequestId} not found`);
    }

    if (request.status !== "pending" && request.status !== "escalated") {
      throw new Error(`ApprovalRequest ${approvalRequestId} has already been actioned (status: ${request.status})`);
    }

    // Check timeouts
    if (new Date() > new Date(request.timeoutAt)) {
      await this.p0Repo.updateApprovalRequestStatus(approvalRequestId, "expired", tx);
      await tx.protocolZeroRequest.update({
        where: { id: request.protocolZeroRequestId },
        data: { status: "expired" },
      });
      throw new Error(`ApprovalRequest ${approvalRequestId} has expired`);
    }

    return request;
  }

  /**
   * Merges and appends approval workflow metadata into Shared Incident Memory.
   */
  private async appendApprovalToSharedMemory(
    incidentId: string,
    decision: string,
    commanderId: string,
    justification: string,
    tx?: any
  ): Promise<void> {
    try {
      const current = await this.sharedMemory.read(incidentId);
      if (!current) return;

      const currentMetadata = current.metadata && typeof current.metadata === "object" ? current.metadata : {};
      const riskPayload = currentMetadata.riskAssessment || {};

      const approvalPayload = {
        status: decision,
        commander: commanderId,
        justification,
        actionedAt: new Date().toISOString(),
        audit: [
          ...(riskPayload.protocolZeroApproval?.audit || []),
          {
            action: `protocol_zero_${decision}`,
            actor: `commander:${commanderId}`,
            timestamp: new Date().toISOString(),
            justification,
          },
        ],
      };

      const updatedFields = {
        metadata: {
          ...currentMetadata,
          riskAssessment: {
            ...riskPayload,
            protocolZeroApproval: approvalPayload,
            isProtocolZeroTriggered: decision === "approved" || decision === "modified",
          },
        },
      };

      await this.sharedMemory.write(incidentId, "protocol-zero-service", {
        status: "success",
        confidence: 1.0,
        reasoning: `Protocol Zero reviewed. Status: ${decision}. Justification: ${justification}`,
        outputData: approvalPayload,
        updatedFields,
      });
    } catch (err: any) {
      logger.error({ err: err.message, incidentId }, "ProtocolZeroService: Shared Incident Memory append failure");
    }
  }

  private broadcastSocketAlert(event: string, payload: any): void {
    try {
      if (typeof socketGateway.initialize === "function") {
        const riskNamespace = (socketGateway as any).io?.of("/risk");
        if (riskNamespace) {
          riskNamespace.emit(event, payload);
          riskNamespace.to(`incident:${payload.incidentId}`).emit(event, payload);
          // Broadcast standard completed trigger if final status reached
          if (event !== "protocol_zero:escalated") {
            riskNamespace.emit("protocol_zero:completed", {
              incidentId: payload.incidentId,
              status: event.split("_").pop(),
              actionedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, "ProtocolZeroService: Socket broadcast error");
    }
  }
}

export const protocolZeroService = new ProtocolZeroService();
