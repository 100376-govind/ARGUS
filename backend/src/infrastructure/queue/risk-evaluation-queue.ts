import { riskEvaluationService } from "@/application/agents/risk-evaluator/risk-evaluation-service";
import { logger } from "@/infrastructure/logger/pino";
import { prisma } from "../database/prisma-client";
import { eventPublisher } from "../events/event-publisher";

interface QueueItem {
  incidentId: string;
  retryCount: number;
  addedAt: number;
}

export class RiskEvaluationQueue {
  private queue: QueueItem[] = [];
  private activeWorkers = 0;
  private readonly concurrencyLimit = 5;
  private readonly maxQueueLength = 100;
  private readonly maxRetries = 3;
  private readonly retryBackoffMs = 1000;

  /**
   * Enqueues an incident risk evaluation request.
   * Enforces backpressure limits.
   */
  public enqueue(incidentId: string): void {
    if (this.queue.length >= this.maxQueueLength) {
      logger.error(
        { incidentId, queueLength: this.queue.length },
        "RiskEvaluationQueue: Queue is full. Applying backpressure by rejecting request"
      );
      throw new Error("Evaluation queue limit exceeded. System is applying backpressure.");
    }

    // Check if incident already in queue
    const exists = this.queue.some((item) => item.incidentId === incidentId);
    if (exists) {
      logger.debug({ incidentId }, "RiskEvaluationQueue: Incident already queued; skipping duplicate");
      return;
    }

    logger.info({ incidentId }, "RiskEvaluationQueue: Enqueuing incident evaluation task");
    this.queue.push({
      incidentId,
      retryCount: 0,
      addedAt: Date.now(),
    });

    // Run process cycle asynchronously
    this.processNext();
  }

  /**
   * Processes the next items in the queue up to the concurrency limit.
   */
  private async processNext(): Promise<void> {
    if (this.activeWorkers >= this.concurrencyLimit) {
      return; // Concurrency limit reached
    }

    const item = this.queue.shift();
    if (!item) {
      return; // Queue is empty
    }

    this.activeWorkers++;
    logger.debug(
      { incidentId: item.incidentId, activeWorkers: this.activeWorkers },
      "RiskEvaluationQueue: Dispatching worker for task"
    );

    // Run task asynchronously
    this.runTask(item).finally(() => {
      this.activeWorkers--;
      this.processNext(); // Schedule next task
    });
  }

  private async runTask(item: QueueItem): Promise<void> {
    try {
      await riskEvaluationService.evaluateIncidentRisk(item.incidentId);
      logger.info(
        { incidentId: item.incidentId, queueTimeMs: Date.now() - item.addedAt },
        "RiskEvaluationQueue: Evaluation task completed successfully"
      );
    } catch (error: any) {
      logger.error(
        { incidentId: item.incidentId, attempt: item.retryCount + 1, error: error.message },
        "RiskEvaluationQueue: Evaluation task failed"
      );

      if (item.retryCount < this.maxRetries) {
        // Enqueue back with exponential backoff delay
        const backoffDelay = this.retryBackoffMs * Math.pow(2, item.retryCount);
        item.retryCount++;
        
        logger.warn(
          { incidentId: item.incidentId, nextAttempt: item.retryCount + 1, delayMs: backoffDelay },
          "RiskEvaluationQueue: Scheduling task retry"
        );

        setTimeout(() => {
          this.queue.push(item);
          this.processNext();
        }, backoffDelay);
      } else {
        logger.error(
          { incidentId: item.incidentId },
          "RiskEvaluationQueue: Max retries exhausted. Sending to DLQ."
        );
        await this.sendToDlq(item, error.message);
      }
    }
  }

  private async sendToDlq(item: QueueItem, reason: string): Promise<void> {
    const dlqPayload = {
      incidentId: item.incidentId,
      failedAt: new Date().toISOString(),
      retryCount: item.retryCount,
      reason,
    };

    logger.error({ dlqPayload }, "CRITICAL_ALERT_QUEUE_DLQ: Evaluation task redirected to DLQ");

    try {
      await prisma.auditLog.create({
        data: {
          incidentId: item.incidentId,
          changedBy: "system:queue-processor:dlq",
          action: "QUEUE_EVALUATION_FAILED_DLQ",
          oldValue: {} as any,
          newValue: dlqPayload as any,
        },
      });
    } catch (dbErr: any) {
      logger.error(
        { dbErr: dbErr.message, incidentId: item.incidentId },
        "RiskEvaluationQueue: Failed to write queue DLQ log to DB"
      );
    }

    try {
      await eventPublisher.publish({
        eventId: `evt-${Math.random().toString(36).substring(2, 11)}`,
        eventType: "RiskEvaluationFailed",
        timestamp: new Date().toISOString(),
        correlationId: "system-queue",
        data: {
          incidentId: item.incidentId,
          errorCode: "QUEUE_RETRIES_EXHAUSTED",
          errorMessage: reason,
        },
      } as any);
    } catch {
      // ignore event system crash
    }
  }

  /**
   * Helper to return current queue statistics.
   */
  public getStats() {
    return {
      pendingTasks: this.queue.length,
      activeWorkers: this.activeWorkers,
      concurrencyLimit: this.concurrencyLimit,
      queueLength: this.queue.length,
    };
  }
}

export const riskEvaluationQueue = new RiskEvaluationQueue();
