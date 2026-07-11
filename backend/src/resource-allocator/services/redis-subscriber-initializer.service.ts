import { eventBus } from "@/shared/container";
import { logger } from "@/infrastructure/logger/pino";

/**
 * Initializes Redis subscribers for Resource Allocator events to log background synchronization.
 */
export async function initializeResourceAllocatorSubscribers(): Promise<void> {
  logger.info("Initializing Resource Allocator Redis subscriptions");

  await eventBus.subscribe("AllocationStarted", (payload: any) => {
    logger.info({ payload }, "Redis Event Received: AllocationStarted");
  });

  await eventBus.subscribe("ResourceMatched", (payload: any) => {
    logger.info({ payload }, "Redis Event Received: ResourceMatched");
  });

  await eventBus.subscribe("DispatchUpdated", (payload: any) => {
    logger.info({ payload }, "Redis Event Received: DispatchUpdated");
  });

  await eventBus.subscribe("ETAUpdated", (payload: any) => {
    logger.info({ payload }, "Redis Event Received: ETAUpdated");
  });

  await eventBus.subscribe("AllocationCompleted", (payload: any) => {
    logger.info({ payload }, "Redis Event Received: AllocationCompleted");
  });
}
