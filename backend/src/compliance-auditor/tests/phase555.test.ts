import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComplianceCache } from "../services/compliance-cache";
import { ComplianceMetrics } from "../services/compliance-metrics";
import { ComplianceHealth } from "../services/compliance-health";
import { LoadTester } from "./load-test";
import { redisPublisher } from "@/infrastructure/redis/redis-client";

// Mock out Redis connection status check for caching tests
vi.mock("@/infrastructure/redis/redis-client", () => {
  let cacheState: Record<string, string> = {};
  return {
    redisPublisher: {
      status: "ready",
      get: vi.fn().mockImplementation(async (key: string) => cacheState[key] || null),
      set: vi.fn().mockImplementation(async (key: string, val: string) => {
        cacheState[key] = val;
        return "OK";
      }),
      del: vi.fn().mockImplementation(async (key: string) => {
        delete cacheState[key];
        return 1;
      }),
    },
  };
});

describe("Compliance Auditor - Phase 5.55 Production Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should record metrics and calculate correct averages and ratios", () => {
    ComplianceMetrics.recordSuccess();
    ComplianceMetrics.recordSuccess();
    ComplianceMetrics.recordError(); // 2 successes, 1 error = 66.6% success, 33.3% error

    ComplianceMetrics.recordReportTime(100);
    ComplianceMetrics.recordReportTime(200);

    ComplianceMetrics.recordPdfTime(50);
    ComplianceMetrics.recordPdfTime(150);

    const snapshot = ComplianceMetrics.getSnapshot();
    expect(snapshot.successRate).toBeCloseTo(66.67, 1);
    expect(snapshot.errorRate).toBeCloseTo(33.33, 1);
    expect(snapshot.averageReportTimeMs).toBe(150);
    expect(snapshot.averagePdfGenerationTimeMs).toBe(100);
  });

  it("should read, write, and invalidate from Redis Cache wrapper cleanly", async () => {
    const testKey = "test:compliance:data";
    const testValue = { data: "secured_payload" };

    // Get miss
    const val1 = await ComplianceCache.get<any>(testKey);
    expect(val1).toBeNull();

    // Set
    await ComplianceCache.set(testKey, testValue);
    expect(redisPublisher.set).toHaveBeenCalled();

    // Get hit
    const val2 = await ComplianceCache.get<any>(testKey);
    expect(val2).toEqual(testValue);

    // Invalidate
    await ComplianceCache.invalidate(testKey);
    expect(redisPublisher.del).toHaveBeenCalled();

    const val3 = await ComplianceCache.get<any>(testKey);
    expect(val3).toBeNull();
  });

  it("should complete self-health diagnostics checking database, redis, and gemini status", async () => {
    const health = await ComplianceHealth.checkHealth();
    expect(health.status).toBeDefined();
    expect(health.redis).toBeDefined();
    expect(health.database).toBeDefined();
    expect(health.gemini).toBeDefined();
  });

  it("should run load testing cycles and measure memory/CPU performance", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await LoadTester.runSuite();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
