import { IEventBus } from "@/domain/services/event-bus";
import { redisPublisher, redisSubscriber } from "./redis-client";
import { logger } from "@/infrastructure/logger/pino";
import { prisma } from "@/infrastructure/database/prisma-client";

export class RedisEventBus implements IEventBus {
  private activeSubscriptions = new Map<string, Array<(payload: any) => void>>();

  constructor() {
    // Listen to messages from Redis channels
    redisSubscriber.on("message", (channel: string, message: string) => {

      try {
        const payload = JSON.parse(message);
        const callbacks = this.activeSubscriptions.get(channel);
        if (callbacks) {
          callbacks.forEach((cb) => {
            try {
              cb(payload);
            } catch (e) {
              logger.error({ error: e, channel }, "Error inside event subscriber callback");
            }
          });
        }
      } catch (err) {
        logger.error({ error: err, channel }, "Failed to parse Redis event message");
      }
    });
  }

  async publish(eventName: string, payload: any): Promise<void> {
    try {
      const messageString = JSON.stringify(payload);
      
      // Atomic publish operation to Redis
      if (redisPublisher.status === "ready") {
        await redisPublisher.publish(eventName, messageString);
      } else {
        logger.warn({ eventName }, "Redis Event Bus: Publisher is not connected. Bypassing Redis publish.");
      }
      
      // Audit log the event into DB for traceability
      await prisma.systemEvent.create({
        data: {
          eventName,
          payload: payload as any,
          status: redisPublisher.status === "ready" ? "published" : "published_offline",
        },
      });

      logger.info({ eventName, payload }, `Event successfully published`);
    } catch (error) {
      logger.error({ error, eventName }, "Event publishing failed");
      
      await prisma.systemEvent.create({
        data: {
          eventName,
          payload: payload as any,
          status: "failed",
        },
      });
      
      throw error;
    }
  }

  async subscribe(eventName: string, callback: (payload: any) => void): Promise<void> {
    const channelCallbacks = this.activeSubscriptions.get(eventName) || [];
    channelCallbacks.push(callback);
    this.activeSubscriptions.set(eventName, channelCallbacks);

    // Register subscription in Redis subscriber client if first callback
    if (channelCallbacks.length === 1) {
      if (redisSubscriber.status === "ready") {
        await redisSubscriber.subscribe(eventName);
        logger.debug({ eventName }, `Subscribed to Redis channel`);
      } else {
        logger.warn({ eventName }, `Redis Event Bus: Subscriber is not connected. Skipping Redis subscribe.`);
      }
    }
  }
}
export const eventBus = new RedisEventBus();
