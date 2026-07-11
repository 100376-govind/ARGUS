import { prisma } from "@/infrastructure/database/prisma-client";
import { redisPublisher } from "@/infrastructure/redis/redis-client";
import { socketGateway } from "@/infrastructure/sockets/socket-gateway";
import { logger } from "@/infrastructure/logger/pino";

/**
 * Health check module returning detailed diagnostic reports for Resource Allocator and downstream dependencies.
 */
export async function performResourceAllocatorHealthCheck(): Promise<{
  status: "healthy" | "warning" | "critical";
  checks: Array<{
    service: string;
    status: "healthy" | "warning" | "critical";
    latencyMs: number;
    error?: string;
  }>;
}> {
  const checks: any[] = [];
  let overallStatus: "healthy" | "warning" | "critical" = "healthy";

  // 1. Check database connectivity
  const dbStart = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({
      service: "database",
      status: "healthy",
      latencyMs: Math.round(performance.now() - dbStart),
    });
  } catch (err: any) {
    overallStatus = "critical";
    checks.push({
      service: "database",
      status: "critical",
      latencyMs: Math.round(performance.now() - dbStart),
      error: err.message,
    });
  }

  // 2. Check Redis connection
  const redisStart = performance.now();
  try {
    if (typeof redisPublisher.ping === "function") {
      await redisPublisher.ping();
      checks.push({
        service: "redis",
        status: "healthy",
        latencyMs: Math.round(performance.now() - redisStart),
      });
    } else {
      checks.push({
        service: "redis",
        status: "warning",
        latencyMs: Math.round(performance.now() - redisStart),
        error: "Redis client mocked",
      });
    }
  } catch (err: any) {
    if (overallStatus !== "critical") overallStatus = "warning";
    checks.push({
      service: "redis",
      status: "critical",
      latencyMs: Math.round(performance.now() - redisStart),
      error: err.message,
    });
  }

  // 3. Check Socket.io setup
  const socketStart = performance.now();
  const io = (socketGateway as any).io;
  if (io) {
    checks.push({
      service: "socket.io",
      status: "healthy",
      latencyMs: Math.round(performance.now() - socketStart),
    });
  } else {
    if (overallStatus !== "critical") overallStatus = "warning";
    checks.push({
      service: "socket.io",
      status: "warning",
      latencyMs: Math.round(performance.now() - socketStart),
      error: "Socket.io instance not initialized",
    });
  }

  return {
    status: overallStatus,
    checks,
  };
}
