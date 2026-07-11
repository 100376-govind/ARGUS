import { BaseEvent } from "@/shared/events/event-contracts";
import { redisPubSub } from "./redis-pubsub";
import { logger } from "@/infrastructure/logger/pino";
import { prisma } from "../database/prisma-client";

export class EventPublisher {
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 200;

  /**
   * Publishes an event to its designated channel.
   * If it fails, retries with exponential backoff.
   * On final failure, routes to the Dead Letter Queue.
   */
  public async publish<T extends BaseEvent>(event: T): Promise<void> {
    const channel = `argus:events:${event.eventType}`;
    let attempt = 0;

    while (attempt < this.maxRetries) {
      try {
        logger.info(
          { eventId: event.eventId, eventType: event.eventType, attempt: attempt + 1 },
          "EventPublisher: Attempting to publish event payload"
        );
        await redisPubSub.publish(channel, event);
        return; // Success
      } catch (err: any) {
        attempt++;
        if (attempt >= this.maxRetries) {
          logger.error(
            { eventId: event.eventId, eventType: event.eventType, error: err.message },
            "EventPublisher: All retries exhausted. Routing to Dead Letter Queue (DLQ)"
          );
          await this.routeToDlq(event, err.message);
          return;
        }

        const delay = this.baseDelayMs * Math.pow(2, attempt);
        logger.warn(
          { eventId: event.eventId, attempt, delayMs: delay },
          "EventPublisher: Publish failed, scheduling retry attempt"
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Routes the failed event payload to the database audit logs and a DLQ log channel.
   */
  private async routeToDlq(event: BaseEvent, errorMessage: string): Promise<void> {
    const dlqPayload = {
      event,
      failedAt: new Date().toISOString(),
      errorMessage,
    };

    // Log critical warning
    logger.error({ dlqPayload }, "CRITICAL_ALERT_DLQ: Event redirected to DLQ");

    try {
      // Persist to database AuditLog table
      const incidentId = (event as any).data?.incidentId || "SYSTEM";

      await prisma.auditLog.create({
        data: {
          incidentId,
          changedBy: "system:event-publisher:dlq",
          action: `DLQ_EVENT_FAILED_${event.eventType}`,
          oldValue: {} as any,
          newValue: dlqPayload as any,
        },
      });
      logger.info({ eventId: event.eventId }, "EventPublisher: DLQ record saved in database successfully");
    } catch (dbErr: any) {
      logger.error(
        { dbErr: dbErr.message, eventId: event.eventId },
        "EventPublisher: DLQ database writing crashed"
      );
    }

    try {
      // Publish to Redis DLQ channel for secondary listeners
      if (typeof redisPubSub.publish === "function") {
        await redisPubSub.publish("argus:events:dlq", dlqPayload);
      }
    } catch {
      // ignore client failures at this stage
    }
  }
}

export const eventPublisher = new EventPublisher();
