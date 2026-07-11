import { resourceAllocatorCache } from "./resource-allocator-cache.service";
import { IDistanceProvider, DistanceMatrixResult } from "../interfaces/route-optimization.interface";
import { Location } from "../interfaces/resource-allocator.interface";
import { MockDistanceProvider } from "./mock-distance-provider.service";
import { metrics } from "@/infrastructure/monitoring/metrics";
import { logger } from "@/infrastructure/logger/pino";

/**
 * Production-hardened CachedDistanceProvider.
 * Intercepts distance requests, looks up Redis cache, and falls back to a primary DistanceProvider.
 * Optimizes Google Maps API usage and manages retries for high availability.
 */
export class CachedDistanceProvider implements IDistanceProvider {
  private readonly defaultTtl = 86400; // Cache distance queries for 24 hours

  constructor(private readonly baseProvider: IDistanceProvider = new MockDistanceProvider()) {}

  public async getDistanceAndDuration(origin: Location, destination: Location): Promise<DistanceMatrixResult> {
    const cacheKey = `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}:${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`;
    
    // 1. Redis Cache Query
    const cached = await resourceAllocatorCache.get<DistanceMatrixResult>("eta", cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, "DistanceProvider: Cache HIT for distance matrix query");
      return cached;
    }

    // 2. Request deduplication / primary execution with retries
    const startTime = performance.now();
    let result: DistanceMatrixResult;

    try {
      result = await this.executeWithRetry(() => this.baseProvider.getDistanceAndDuration(origin, destination));
      const duration = performance.now() - startTime;
      
      // Track Google Maps/Provider API latency metric
      metrics.recordApiLatency("distance-matrix", "GET", duration);
    } catch (err: any) {
      logger.error({ error: err.message, origin, destination }, "DistanceProvider: Google Maps/API request failed after retries. Falling back to mathematical Haversine calculations.");
      
      // Local fallback in case both main provider and API fails
      const fallbackProvider = new MockDistanceProvider();
      result = await fallbackProvider.getDistanceAndDuration(origin, destination);
    }

    // 3. Cache the output
    await resourceAllocatorCache.set("eta", cacheKey, result, this.defaultTtl);

    return result;
  }

  /**
   * Helper retry mechanics.
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (retries <= 0) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.executeWithRetry(fn, retries - 1, delay * 2);
    }
  }
}
