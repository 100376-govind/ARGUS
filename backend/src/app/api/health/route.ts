import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/database/prisma-client";
import { logger } from "@/infrastructure/logger/pino";

interface HealthCheck {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  error?: string;
}

/**
 * GET /api/health — System health check endpoint.
 * Checks database, Redis, Firebase, and Gemini connectivity.
 */
export async function GET() {
  const checks: HealthCheck[] = [];
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Check PostgreSQL / Prisma
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({
      service: "postgresql",
      status: "healthy",
      latencyMs: Date.now() - dbStart,
    });
  } catch (err: any) {
    checks.push({
      service: "postgresql",
      status: "unhealthy",
      latencyMs: Date.now() - dbStart,
      error: err.message,
    });
    overallStatus = "unhealthy";
  }

  // Check Redis (if configured)
  const redisStart = Date.now();
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const { default: Redis } = await import("ioredis");
      const redis = new Redis(redisUrl, { connectTimeout: 3000, lazyConnect: true });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      checks.push({
        service: "redis",
        status: "healthy",
        latencyMs: Date.now() - redisStart,
      });
    } else {
      checks.push({
        service: "redis",
        status: "degraded",
        error: "REDIS_URL not configured, using in-memory event bus fallback",
      });
      if (overallStatus === "healthy") overallStatus = "degraded";
    }
  } catch (err: any) {
    checks.push({
      service: "redis",
      status: "degraded",
      latencyMs: Date.now() - redisStart,
      error: err.message,
    });
    if (overallStatus === "healthy") overallStatus = "degraded";
  }

  // Check Firebase (just checks that env var is set)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    checks.push({ service: "firebase", status: "healthy" });
  } else {
    checks.push({
      service: "firebase",
      status: "degraded",
      error: "FIREBASE_SERVICE_ACCOUNT_KEY not configured",
    });
    if (overallStatus === "healthy") overallStatus = "degraded";
  }

  // Check Gemini (just checks that env var is set)
  if (process.env.GEMINI_API_KEY) {
    checks.push({ service: "gemini", status: "healthy" });
  } else {
    checks.push({
      service: "gemini",
      status: "unhealthy",
      error: "GEMINI_API_KEY not configured",
    });
    overallStatus = "unhealthy";
  }

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  logger.debug({ overallStatus, checks }, "Health check completed");

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || "0.1.0",
      checks,
    },
    { status: statusCode }
  );
}
