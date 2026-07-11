import { redisPublisher } from "@/infrastructure/redis/redis-client";
import { logger } from "@/infrastructure/logger/pino";

export class ComplianceCache {
  private static readonly TTL_SECONDS = 300; // 5 minutes

  public static async get<T>(key: string): Promise<T | null> {
    if (redisPublisher.status !== "ready") {
      logger.debug({ key }, "Compliance Cache: Redis offline, bypassing cache read");
      return null;
    }

    try {
      const value = await redisPublisher.get(key);
      if (value) {
        logger.info({ key }, "Compliance Cache: Hit");
        return JSON.parse(value) as T;
      }
      logger.info({ key }, "Compliance Cache: Miss");
      return null;
    } catch (err: any) {
      logger.warn({ key, err: err.message }, "Compliance Cache: Error reading from Redis");
      return null;
    }
  }

  public static async set(key: string, value: any): Promise<void> {
    if (redisPublisher.status !== "ready") {
      return;
    }

    try {
      await redisPublisher.set(key, JSON.stringify(value), "EX", this.TTL_SECONDS);
      logger.info({ key }, "Compliance Cache: Written successfully");
    } catch (err: any) {
      logger.warn({ key, err: err.message }, "Compliance Cache: Error writing to Redis");
    }
  }

  public static async invalidate(key: string): Promise<void> {
    if (redisPublisher.status !== "ready") {
      return;
    }

    try {
      await redisPublisher.del(key);
      logger.info({ key }, "Compliance Cache: Invalidated successfully");
    } catch (err: any) {
      logger.warn({ key, err: err.message }, "Compliance Cache: Error invalidating cache key");
    }
  }
}
