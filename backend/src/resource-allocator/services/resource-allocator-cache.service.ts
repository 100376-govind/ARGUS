import { redisPublisher } from "@/infrastructure/redis/redis-client";
import { logger } from "@/infrastructure/logger/pino";
import { metrics } from "@/infrastructure/monitoring/metrics";

/**
 * Production Redis Cache Manager for Resource Allocator.
 * Caches Allocations, ETAs, Nearest Resources, and Dispatch Plans.
 * Fully supports TTL and invalidation with safe fallback options.
 */
export class ResourceAllocatorCache {
  private readonly client = redisPublisher;
  private readonly defaultTtl: number = 600; // 10 minutes default TTL

  private getCacheKey(type: "alloc" | "eta" | "nearest" | "plan", keyId: string): string {
    return `argus:res-allocator:${type}:${keyId}`;
  }

  /**
   * Safe fetch utility.
   */
  public async get<T>(type: "alloc" | "eta" | "nearest" | "plan", keyId: string): Promise<T | null> {
    const startTime = performance.now();
    try {
      if (typeof this.client.get !== "function") {
        return null;
      }
      const key = this.getCacheKey(type, keyId);
      const data = await this.client.get(key);
      metrics.recordRedisLatency("get", performance.now() - startTime);

      if (!data) return null;

      logger.debug({ type, keyId }, "ResourceAllocatorCache: Cache hit");
      return JSON.parse(data) as T;
    } catch (error: any) {
      logger.warn({ type, keyId, error: error.message }, "ResourceAllocatorCache: Read fallback activated");
      return null;
    }
  }

  /**
   * Safe cache write utility.
   */
  public async set<T>(
    type: "alloc" | "eta" | "nearest" | "plan",
    keyId: string,
    value: T,
    ttlSeconds?: number
  ): Promise<void> {
    const startTime = performance.now();
    try {
      if (typeof this.client.set !== "function") {
        return;
      }
      const key = this.getCacheKey(type, keyId);
      const dataStr = JSON.stringify(value);
      const ttl = ttlSeconds ?? this.defaultTtl;

      await this.client.set(key, dataStr, "EX", ttl);
      metrics.recordRedisLatency("set", performance.now() - startTime);
      logger.debug({ type, keyId, ttl }, "ResourceAllocatorCache: Cache written");
    } catch (error: any) {
      logger.warn({ type, keyId, error: error.message }, "ResourceAllocatorCache: Write fallback activated");
    }
  }

  /**
   * Invalidate cached keys.
   */
  public async invalidate(incidentId: string): Promise<void> {
    const startTime = performance.now();
    try {
      if (typeof this.client.del !== "function") {
        return;
      }
      const keys = [
        this.getCacheKey("alloc", incidentId),
        this.getCacheKey("eta", incidentId),
        this.getCacheKey("nearest", incidentId),
        this.getCacheKey("plan", incidentId),
      ];
      for (const key of keys) {
        await this.client.del(key);
      }
      metrics.recordRedisLatency("del", performance.now() - startTime);
      logger.debug({ incidentId }, "ResourceAllocatorCache: Cache invalidated successfully");
    } catch (error: any) {
      logger.warn({ incidentId, error: error.message }, "ResourceAllocatorCache: Invalidation fallback activated");
    }
  }
}

export const resourceAllocatorCache = new ResourceAllocatorCache();
