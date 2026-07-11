import { PrismaClient } from "@prisma/client";
import { env } from "@/shared/config/env";
import { logger } from "@/infrastructure/logger/pino";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" },
          ]
        : ["error"],
  });

if (env.NODE_ENV === "development") {
  global.prisma = prisma;
}

// Log queries in development
if (env.NODE_ENV === "development") {
  (prisma as any).$on("query", (e: any) => {
    logger.debug({ query: e.query, params: e.params, duration: `${e.duration}ms` }, "Prisma Query Execution");
  });
}
