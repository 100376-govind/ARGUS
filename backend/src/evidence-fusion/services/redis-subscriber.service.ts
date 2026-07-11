import { eventBus } from "../../infrastructure/redis/redis-event-bus";
import { socketGateway } from "../../infrastructure/sockets/socket-gateway";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export class ValidationRedisSubscriber {
  private logger = new FieldValidatorLogger("ValidationRedisSubscriber");
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.debug("Redis Subscriber already initialized. Skipping.");
      return;
    }
    this.isInitialized = true;
    this.logger.info("Initializing Redis Event Subscribers for Field Validator");


    // 1. ValidationStarted channel
    await eventBus.subscribe("ValidationStarted", (payload: any) => {
      this.logger.debug("Received ValidationStarted from Redis", payload);
      if (payload?.incidentId) {
        socketGateway.broadcastValidationStarted(payload.incidentId);
      }
    });

    // 2. ValidationUpdated channel
    await eventBus.subscribe("ValidationUpdated", (payload: any) => {
      this.logger.debug("Received ValidationUpdated from Redis", payload);
      if (payload?.incidentId) {
        socketGateway.broadcastFusionCompleted(payload.incidentId, payload.score || 0, payload.status || "Pending");
      }
    });

    // 3. ValidationCompleted channel
    await eventBus.subscribe("ValidationCompleted", (payload: any) => {
      this.logger.debug("Received ValidationCompleted from Redis", payload);
      if (payload?.incidentId) {
        socketGateway.broadcastValidationCompleted(payload.incidentId, payload.report);
      }
    });

    // 4. NetworkMetricsUpdated channel
    await eventBus.subscribe("NetworkMetricsUpdated", (payload: any) => {
      this.logger.debug("Received NetworkMetricsUpdated from Redis", payload);
      if (payload?.incidentId) {
        socketGateway.broadcastNetworkCollected(payload.incidentId, payload.metrics);
      }
    });

    // 5. EvidenceUpdated channel
    await eventBus.subscribe("EvidenceUpdated", (payload: any) => {
      this.logger.debug("Received EvidenceUpdated from Redis", payload);
      if (payload?.incidentId) {
        socketGateway.broadcastEvidenceCollected(payload.incidentId, 1);
      }
    });
  }
}

export const validationRedisSubscriber = new ValidationRedisSubscriber();
