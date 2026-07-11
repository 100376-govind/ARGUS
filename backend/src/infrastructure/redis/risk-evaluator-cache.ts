import { redisPublisher } from "./redis-client";
import { logger } from "@/infrastructure/logger/pino";
import { RedisFailureError } from "@/shared/errors/risk-evaluator-service-errors";

export class RiskEvaluatorCache {
  private readonly client = redisPublisher;
  private readonly defaultTtl: number = 300; // 5 minutes default TTL

  constructor(ttlSeconds?: number) {
    if (ttlSeconds) {
      this.defaultTtl = ttlSeconds;
    }
  }

  private getCacheKey(incidentId: string): string {
    return `argus:risk-assessment:${incidentId}`;
  }

  /**
   * Retrieves a cached risk assessment by incident ID.
   * Returns null if cache miss or Redis is unavailable.
   */
  public async get(incidentId: string): Promise<any | null> {
    try {
      // Check if client has get method (mocks in test might not have it)
      if (typeof this.client.get !== "function") {
        return null;
      }
      const key = this.getCacheKey(incidentId);
      const data = await this.client.get(key);
      if (!data) return null;

      logger.debug({ incidentId }, "RiskEvaluatorCache: Cache hit");
      return JSON.parse(data);
    } catch (error: any) {
      logger.warn({ incidentId, error: error.message }, "RiskEvaluatorCache: Failed to read from Redis cache");
      return null; // Fallback gracefully
    }
  }

  /**
   * Caches a risk assessment.
   */
  public async set(incidentId: string, assessment: any, ttlSeconds?: number): Promise<void> {
    try {
      if (typeof this.client.set !== "function") {
        return;
      }
      const key = this.getCacheKey(incidentId);
      const dataStr = JSON.stringify(assessment);
      const ttl = ttlSeconds ?? this.defaultTtl;

      await this.client.set(key, dataStr, "EX", ttl);
      logger.debug({ incidentId, ttl }, "RiskEvaluatorCache: Assessment cached successfully");
    } catch (error: any) {
      logger.warn({ incidentId, error: error.message }, "RiskEvaluatorCache: Failed to write to Redis cache");
    }
  }

  /**
   * Invalidates a cached assessment.
   */
  public async invalidate(incidentId: string): Promise<void> {
    try {
      if (typeof this.client.del !== "function") {
        return;
      }
      const key = this.getCacheKey(incidentId);
      await this.client.del(key);
      logger.debug({ incidentId }, "RiskEvaluatorCache: Cache invalidated");
    } catch (error: any) {
      logger.warn({ incidentId, error: error.message }, "RiskEvaluatorCache: Failed to delete cache key");
    }
  }
}

export const riskEvaluatorCache = new RiskEvaluatorCache();
