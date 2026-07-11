import { redisPublisher, redisSubscriber } from "../redis/redis-client";
import { logger } from "@/infrastructure/logger/pino";
import { RedisFailureError } from "@/shared/errors/risk-evaluator-service-errors";

export class RedisPubSub {
  private readonly pub = redisPublisher;
  private readonly sub = redisSubscriber;
  private readonly activeSubscriptions: Map<string, ((message: any) => void)[]> = new Map();

  constructor() {
    this.setupSubscriberCallback();
  }

  private setupSubscriberCallback(): void {
    if (typeof this.sub.on !== "function") return;

    this.sub.on("message", (channel: string, messageStr: string) => {
      logger.debug({ channel }, "RedisPubSub: Received message channel broadcast");
      const handlers = this.activeSubscriptions.get(channel);
      if (!handlers || handlers.length === 0) return;

      try {
        const payload = JSON.parse(messageStr);
        handlers.forEach((handler) => {
          try {
            handler(payload);
          } catch (handlerErr: any) {
            logger.error({ handlerErr, channel }, "RedisPubSub: Subscription callback handler crashed");
          }
        });
      } catch (parseErr: any) {
        logger.error({ parseErr, channel, messageStr }, "RedisPubSub: Failed to parse message JSON payload");
      }
    });
  }

  /**
   * Publishes a message payload to a Redis channel.
   */
  public async publish(channel: string, message: any): Promise<void> {
    try {
      if (typeof this.pub.publish !== "function") {
        logger.warn({ channel }, "RedisPubSub: Publisher client is mock; skipping broadcast");
        return;
      }
      const dataStr = JSON.stringify(message);
      await this.pub.publish(channel, dataStr);
      logger.debug({ channel }, "RedisPubSub: Successfully published event payload");
    } catch (error: any) {
      logger.error({ channel, error: error.message }, "RedisPubSub: Failed to publish message to channel");
      throw new RedisFailureError(`Redis publish to channel ${channel} failed: ${error.message}`, error);
    }
  }

  /**
   * Subscribes a handler callback to a Redis channel.
   */
  public async subscribe(channel: string, handler: (message: any) => void): Promise<void> {
    try {
      if (typeof this.sub.subscribe !== "function") {
        logger.warn({ channel }, "RedisPubSub: Subscriber client is mock; skipping subscription");
        return;
      }

      let handlers = this.activeSubscriptions.get(channel);
      if (!handlers) {
        handlers = [];
        this.activeSubscriptions.set(channel, handlers);
        await this.sub.subscribe(channel);
        logger.info({ channel }, "RedisPubSub: Registered subscription channel with Redis");
      }
      handlers.push(handler);
    } catch (error: any) {
      logger.error({ channel, error: error.message }, "RedisPubSub: Failed to subscribe to channel");
      throw new RedisFailureError(`Redis subscribe to channel ${channel} failed: ${error.message}`, error);
    }
  }

  /**
   * Unsubscribes a channel or removes all local subscriptions.
   */
  public async unsubscribe(channel: string): Promise<void> {
    try {
      this.activeSubscriptions.delete(channel);
      if (typeof this.sub.unsubscribe === "function") {
        await this.sub.unsubscribe(channel);
        logger.info({ channel }, "RedisPubSub: Unsubscribed from Redis channel");
      }
    } catch (error: any) {
      logger.warn({ channel, error: error.message }, "RedisPubSub: Failed to unsubscribe cleanly");
    }
  }
}

export const redisPubSub = new RedisPubSub();
