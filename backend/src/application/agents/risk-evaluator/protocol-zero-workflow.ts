import { prisma } from "@/infrastructure/database/prisma-client";
import { protocolZeroRepository } from "@/infrastructure/database/protocol-zero-repository";
import { socketGateway } from "@/infrastructure/sockets/socket-gateway";
import { logger } from "@/infrastructure/logger/pino";

export class ProtocolZeroWorkflowProcessor {
  private readonly p0Repo = protocolZeroRepository;
  private readonly backupCommanderId = "commander-backup-level-2";

  /**
   * Processes all active pending/escalated approvals to handle timeout actions,
   * trigger automatic escalations, or expire un-actioned overrides.
   */
  public async processPendingTimeouts(): Promise<void> {
    logger.debug("ProtocolZeroWorkflowProcessor: Running timeout processing cycle");

    try {
      const activeRequests = await prisma.approvalRequest.findMany({
        where: {
          status: { in: ["pending", "escalated"] },
        },
        include: {
          protocolZeroRequest: {
            include: { riskAssessment: true },
          },
          approvalHistories: true,
        },
      });

      const now = new Date();

      for (const request of activeRequests) {
        const timeoutAt = new Date(request.timeoutAt);
        const incidentId = request.protocolZeroRequest.riskAssessment.incidentId;

        // 1. Check for expiration / timeout breaches
        if (now > timeoutAt) {
          if (request.status === "pending") {
            // Escalate to backup level-2 commander
            logger.warn(
              { approvalRequestId: request.id, incidentId },
              "ProtocolZeroWorkflowProcessor: Timeout exceeded. Initiating auto-escalation"
            );
            await this.escalateAutomatically(request, incidentId);
          } else if (request.status === "escalated") {
            // Mark as expired
            logger.error(
              { approvalRequestId: request.id, incidentId },
              "ProtocolZeroWorkflowProcessor: Escalated timeout exceeded. Expiring request"
            );
            await this.expireRequest(request, incidentId);
          }
        }
        // 2. Check for reminder trigger window (e.g. 5 minutes remaining, no reminder sent yet)
        else {
          const timeRemainingMs = timeoutAt.getTime() - now.getTime();
          const fiveMinutesMs = 5 * 60 * 1000;
          
          if (timeRemainingMs < fiveMinutesMs) {
            const hasSentReminder = request.approvalHistories.some(
              (h: any) => h.action === "reminder_sent"

            );
            if (!hasSentReminder) {
              await this.triggerAutomaticReminder(request, incidentId);
            }
          }
        }
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "ProtocolZeroWorkflowProcessor: Timeout processing loop failed");
    }
  }

  private async escalateAutomatically(request: any, incidentId: string): Promise<void> {
    await prisma.$transaction(async (tx: any) => {
      // Update status and commander ID, extend timeout by 10 mins
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: "escalated",
          commanderId: this.backupCommanderId,
          timeoutAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      // Record escalation history
      await this.p0Repo.createEscalationHistory(
        {
          approvalRequestId: request.id,
          previousCommanderId: request.commanderId || undefined,
          escalatedToCommanderId: this.backupCommanderId,
          reason: "Automatic system escalation due to commander response timeout limit breached.",
        },
        tx
      );

      // Log history audit
      await this.p0Repo.createApprovalHistory(
        {
          approvalRequestId: request.id,
          action: "escalated",
          actor: "system:workflow-processor",
          notes: `Auto-escalated to backup commander: ${this.backupCommanderId}`,
        },
        tx
      );

      // Socket broadcast
      this.emitSocketAlert("protocol_zero:escalated", {
        approvalRequestId: request.id,
        incidentId,
        previousCommanderId: request.commanderId,
        escalatedToCommanderId: this.backupCommanderId,
        reason: "Response timeout limit reached.",
      });
    });
  }

  private async expireRequest(request: any, incidentId: string): Promise<void> {
    await prisma.$transaction(async (tx: any) => {
      // Mark ApprovalRequest expired
      await tx.approvalRequest.update({
        where: { id: request.id },
        data: { status: "expired" },
      });

      // Update ProtocolZeroRequest status
      await tx.protocolZeroRequest.update({
        where: { id: request.protocolZeroRequestId },
        data: { status: "expired" },
      });

      // Log history audit
      await this.p0Repo.createApprovalHistory(
        {
          approvalRequestId: request.id,
          action: "expired",
          actor: "system:workflow-processor",
          notes: "Escalated commander approval window expired without action.",
        },
        tx
      );

      // Socket broadcast
      this.emitSocketAlert("protocol_zero:expired", {
        approvalRequestId: request.id,
        incidentId,
        reason: "All commander review escalations timed out.",
      });
    });
  }

  private async triggerAutomaticReminder(request: any, incidentId: string): Promise<void> {
    await prisma.$transaction(async (tx: any) => {
      // Log history audit
      await this.p0Repo.createApprovalHistory(
        {
          approvalRequestId: request.id,
          action: "reminder_sent",
          actor: "system:workflow-processor",
          notes: "Automatic system warning: less than 5 minutes remaining for review authorization.",
        },
        tx
      );

      // Socket broadcast
      this.emitSocketAlert("protocol_zero:reminder", {
        approvalRequestId: request.id,
        incidentId,
        commanderId: request.commanderId,
        message: "Action required: Protocol Zero approval request window is closing soon.",
      });
    });
  }

  private emitSocketAlert(event: string, payload: any): void {
    try {
      if (typeof socketGateway.initialize === "function") {
        const riskNamespace = (socketGateway as any).io?.of("/risk");
        if (riskNamespace) {
          riskNamespace.emit(event, payload);
          riskNamespace.to(`incident:${payload.incidentId}`).emit(event, payload);
        }
      }
    } catch {
      // suppress socket errors in background loop
    }
  }
}

export const protocolZeroWorkflowProcessor = new ProtocolZeroWorkflowProcessor();
