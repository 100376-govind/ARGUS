import { IncidentCreatedEvent, RiskEvaluatedEvent, RiskEvaluationFailedEvent, RiskEvaluationStartedEvent, CriticalIncidentDetectedEvent, ProtocolZeroRecommendedEvent } from "@/shared/events/event-contracts";
import { redisPubSub } from "./redis-pubsub";
import { eventPublisher } from "./event-publisher";
import { riskEvaluationService } from "@/application/agents/risk-evaluator/risk-evaluation-service";
import { logger } from "@/infrastructure/logger/pino";

export class EventSubscriber {
  /**
   * Begins listening to channels on the message bus.
   */
  public async startListening(): Promise<void> {
    logger.info("EventSubscriber: Initializing subscriptions");

    // Listen for new incidents created by the Data Dispatcher
    await redisPubSub.subscribe("argus:events:IncidentCreated", async (message: any) => {
      const event = message as IncidentCreatedEvent;
      await this.handleIncidentCreated(event);
    });
  }

  private async handleIncidentCreated(event: IncidentCreatedEvent): Promise<void> {
    const { incidentId } = event.data;
    const correlationId = event.correlationId || `corr-${Math.random().toString(36).substring(2, 11)}`;

    logger.info(
      { incidentId, correlationId },
      "EventSubscriber: Received IncidentCreated alert, starting evaluation process"
    );

    // 1. Emit RiskEvaluationStarted event
    const startEvent: RiskEvaluationStartedEvent = {
      eventId: `evt-${Math.random().toString(36).substring(2, 11)}`,
      eventType: "RiskEvaluationStarted",
      timestamp: new Date().toISOString(),
      correlationId,
      data: { incidentId },
    };
    await eventPublisher.publish(startEvent);

    try {
      // 2. Execute Risk evaluation pipeline
      const assessment = await riskEvaluationService.evaluateIncidentRisk(incidentId);

      // 3. Emit RiskEvaluated event
      const evaluatedEvent: RiskEvaluatedEvent = {
        eventId: `evt-${Math.random().toString(36).substring(2, 11)}`,
        eventType: "RiskEvaluated",
        timestamp: new Date().toISOString(),
        correlationId,
        data: {
          incidentId,
          assessmentId: assessment.id,
          severity: assessment.severity,
          priority: assessment.priority,
          overallRiskScore: assessment.overallRiskScore,
          confidence: assessment.confidence,
          reasoning: assessment.reasoning,
          isProtocolZeroTriggered: assessment.isProtocolZeroTriggered,
        },
      };
      await eventPublisher.publish(evaluatedEvent);

      // 4. If critical severity, emit CriticalIncidentDetected event
      if (assessment.severity === "CRITICAL" || (assessment.severity as string) === "CATASTROPHIC") {
        const criticalEvent: CriticalIncidentDetectedEvent = {
          eventId: `evt-${Math.random().toString(36).substring(2, 11)}`,
          eventType: "CriticalIncidentDetected",
          timestamp: new Date().toISOString(),
          correlationId,
          data: {
            incidentId,
            severity: assessment.severity,
            overallRiskScore: assessment.overallRiskScore,
            reasoning: assessment.reasoning,
          },
        };
        await eventPublisher.publish(criticalEvent);
      }

      // 5. If Protocol Zero is triggered, emit ProtocolZeroRecommended event
      if (assessment.isProtocolZeroTriggered) {
        const p0Event: ProtocolZeroRecommendedEvent = {
          eventId: `evt-${Math.random().toString(36).substring(2, 11)}`,
          eventType: "ProtocolZeroRecommended",
          timestamp: new Date().toISOString(),
          correlationId,
          data: {
            incidentId,
            assessmentId: assessment.id,
            reason: assessment.reasoning,
          },
        };
        await eventPublisher.publish(p0Event);
      }
    } catch (err: any) {
      logger.error(
        { incidentId, error: err.message },
        "EventSubscriber: Risk evaluation flow crashed"
      );

      // Emit RiskEvaluationFailed event
      const failedEvent: RiskEvaluationFailedEvent = {
        eventId: `evt-${Math.random().toString(36).substring(2, 11)}`,
        eventType: "RiskEvaluationFailed",
        timestamp: new Date().toISOString(),
        correlationId,
        data: {
          incidentId,
          errorCode: err.errorCode || "EVALUATION_CRASHED",
          errorMessage: err.message || "Unknown processing failure",
        },
      };
      await eventPublisher.publish(failedEvent);
    }
  }
}

export const eventSubscriber = new EventSubscriber();
