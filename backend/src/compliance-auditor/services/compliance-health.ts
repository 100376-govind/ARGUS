import { redisPublisher } from "@/infrastructure/redis/redis-client";
import { env } from "@/shared/config/env";
import { PrismaClient } from "@prisma/client";

export interface HealthCheckResult {
  status: "Healthy" | "Warning" | "Critical";
  database: string;
  redis: string;
  gemini: string;
  socket: string;
  complianceAuditor: string;
}

const prisma = new PrismaClient();

export class ComplianceHealth {
  public static async checkHealth(): Promise<HealthCheckResult> {
    let dbStatus: "Healthy" | "Critical" = "Healthy";
    let redisStatus: "Healthy" | "Warning" = "Healthy";
    let geminiStatus: "Healthy" | "Warning" = "Healthy";
    
    // 1. Database Check
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "Critical";
    }

    // 2. Redis Check
    if (redisPublisher.status !== "ready") {
      redisStatus = "Warning";
    }

    // 3. Gemini Check
    const key = env.GEMINI_API_KEY;
    if (!key || key === "your-gemini-api-key") {
      geminiStatus = "Warning";
    }

    // Determine overall status
    let status: HealthCheckResult["status"] = "Healthy";
    if (dbStatus === "Critical") {
      status = "Critical";
    } else if (redisStatus === "Warning" || geminiStatus === "Warning") {
      status = "Warning";
    }

    return {
      status,
      database: dbStatus,
      redis: redisStatus,
      gemini: geminiStatus,
      socket: "Healthy",
      complianceAuditor: "Healthy",
    };
  }
}
