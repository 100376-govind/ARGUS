import { eventBus } from "../../infrastructure/redis/redis-event-bus";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export class ValidationRedisPublisher {
  private logger = new FieldValidatorLogger("ValidationRedisPublisher");

  public async publishValidationStarted(incidentId: string): Promise<void> {
    this.logger.debug(`Publishing ValidationStarted to Redis: ${incidentId}`);
    await eventBus.publish("ValidationStarted", { incidentId, timestamp: Date.now() });
  }

  public async publishValidationUpdated(incidentId: string, status: string, score: number): Promise<void> {
    this.logger.debug(`Publishing ValidationUpdated to Redis: ${incidentId}`);
    await eventBus.publish("ValidationUpdated", { incidentId, status, score, timestamp: Date.now() });
  }

  public async publishValidationCompleted(incidentId: string, report: any): Promise<void> {
    this.logger.debug(`Publishing ValidationCompleted to Redis: ${incidentId}`);
    await eventBus.publish("ValidationCompleted", { incidentId, report, timestamp: Date.now() });
  }

  public async publishNetworkMetricsUpdated(incidentId: string, metrics: any): Promise<void> {
    this.logger.debug(`Publishing NetworkMetricsUpdated to Redis: ${incidentId}`);
    await eventBus.publish("NetworkMetricsUpdated", { incidentId, metrics, timestamp: Date.now() });
  }

  public async publishEvidenceUpdated(incidentId: string, source: string, confidence: number): Promise<void> {
    this.logger.debug(`Publishing EvidenceUpdated to Redis: ${incidentId}`);
    await eventBus.publish("EvidenceUpdated", { incidentId, source, confidence, timestamp: Date.now() });
  }

  public async publishConfidenceUpdated(incidentId: string, confidence: number): Promise<void> {
    this.logger.debug(`Publishing ConfidenceUpdated to Redis: ${incidentId}`);
    await eventBus.publish("ConfidenceUpdated", { incidentId, confidence, timestamp: Date.now() });
  }

  public async publishDashboardRefresh(incidentId: string): Promise<void> {
    this.logger.debug(`Publishing DashboardRefresh to Redis: ${incidentId}`);
    await eventBus.publish("DashboardRefresh", { incidentId, timestamp: Date.now() });
  }
}

export const validationRedisPublisher = new ValidationRedisPublisher();
