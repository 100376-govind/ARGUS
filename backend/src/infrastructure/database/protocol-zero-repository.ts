import { prisma } from "./prisma-client";
import { DatabaseError } from "@/shared/errors/risk-evaluator-service-errors";

export class ProtocolZeroRepository {
  /**
   * Creates a new ApprovalRequest record.
   */
  public async createApprovalRequest(
    data: { protocolZeroRequestId: string; commanderId?: string; timeoutAt: Date; status?: string },
    tx?: any
  ): Promise<any> {
    const client = tx || prisma;
    try {
      return await client.approvalRequest.create({
        data: {
          protocolZeroRequestId: data.protocolZeroRequestId,
          commanderId: data.commanderId,
          timeoutAt: data.timeoutAt,
          status: data.status || "pending",
        },
        include: {
          approvalDecisions: true,
          approvalHistories: true,
          escalationHistories: true,
        },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to create ApprovalRequest: ${error.message}`, error);
    }
  }

  /**
   * Retrieves an ApprovalRequest by ID.
   */
  public async getApprovalRequestById(id: string, tx?: any): Promise<any | null> {
    const client = tx || prisma;
    try {
      return await client.approvalRequest.findUnique({
        where: { id },
        include: {
          approvalDecisions: true,
          approvalHistories: true,
          escalationHistories: true,
        },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to find ApprovalRequest by ID: ${error.message}`, error);
    }
  }

  /**
   * Retrieves an ApprovalRequest by its linked ProtocolZeroRequest ID.
   */
  public async getApprovalRequestByProtocolZeroRequestId(p0RequestId: string, tx?: any): Promise<any | null> {
    const client = tx || prisma;
    try {
      return await client.approvalRequest.findFirst({
        where: { protocolZeroRequestId: p0RequestId },
        include: {
          approvalDecisions: true,
          approvalHistories: true,
          escalationHistories: true,
        },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to find ApprovalRequest by ProtocolZeroRequest ID: ${error.message}`, error);
    }
  }

  /**
   * Updates an ApprovalRequest status.
   */
  public async updateApprovalRequestStatus(id: string, status: string, tx?: any): Promise<any> {
    const client = tx || prisma;
    try {
      return await client.approvalRequest.update({
        where: { id },
        data: { status },
        include: {
          approvalDecisions: true,
          approvalHistories: true,
          escalationHistories: true,
        },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to update ApprovalRequest status: ${error.message}`, error);
    }
  }

  /**
   * Logs a commander's decision.
   */
  public async createApprovalDecision(
    data: { approvalRequestId: string; commanderId: string; decision: string; justification: string; modificationPayload?: any },
    tx?: any
  ): Promise<any> {
    const client = tx || prisma;
    try {
      return await client.approvalDecision.create({
        data: {
          approvalRequestId: data.approvalRequestId,
          commanderId: data.commanderId,
          decision: data.decision,
          justification: data.justification,
          modificationPayload: data.modificationPayload || undefined,
        },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to record ApprovalDecision: ${error.message}`, error);
    }
  }

  /**
   * Logs a Commander Override.
   */
  public async createCommanderOverride(
    data: { riskAssessmentId: string; commanderId: string; reason: string; overriddenSeverity?: string; overriddenPriority?: string },
    tx?: any
  ): Promise<any> {
    const client = tx || prisma;
    try {
      return await client.commanderOverride.create({
        data: {
          riskAssessmentId: data.riskAssessmentId,
          commanderId: data.commanderId,
          reason: data.reason,
          overriddenSeverity: data.overriddenSeverity || undefined,
          overriddenPriority: data.overriddenPriority || undefined,
        },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to record CommanderOverride: ${error.message}`, error);
    }
  }

  /**
   * Appends an audit log record to ApprovalHistory.
   */
  public async createApprovalHistory(
    data: { approvalRequestId: string; action: string; actor: string; notes?: string },
    tx?: any
  ): Promise<any> {
    const client = tx || prisma;
    try {
      return await client.approvalHistory.create({
        data: {
          approvalRequestId: data.approvalRequestId,
          action: data.action,
          actor: data.actor,
          notes: data.notes || undefined,
        },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to log ApprovalHistory: ${error.message}`, error);
    }
  }

  /**
   * Gets approval history records for an approval request.
   */
  public async getApprovalHistory(approvalRequestId: string, tx?: any): Promise<any[]> {
    const client = tx || prisma;
    try {
      return await client.approvalHistory.findMany({
        where: { approvalRequestId },
        orderBy: { createdAt: "asc" },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to retrieve ApprovalHistory: ${error.message}`, error);
    }
  }

  /**
   * Logs an escalation.
   */
  public async createEscalationHistory(
    data: { approvalRequestId: string; previousCommanderId?: string; escalatedToCommanderId: string; reason: string },
    tx?: any
  ): Promise<any> {
    const client = tx || prisma;
    try {
      return await client.escalationHistory.create({
        data: {
          approvalRequestId: data.approvalRequestId,
          previousCommanderId: data.previousCommanderId || undefined,
          escalatedToCommanderId: data.escalatedToCommanderId,
          reason: data.reason,
        },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to record EscalationHistory: ${error.message}`, error);
    }
  }

  /**
   * Gets escalation history records.
   */
  public async getEscalationHistory(approvalRequestId: string, tx?: any): Promise<any[]> {
    const client = tx || prisma;
    try {
      return await client.escalationHistory.findMany({
        where: { approvalRequestId },
        orderBy: { createdAt: "asc" },
      });
    } catch (error: any) {
      throw new DatabaseError(`Failed to retrieve EscalationHistory: ${error.message}`, error);
    }
  }
}

export const protocolZeroRepository = new ProtocolZeroRepository();
