import Redis from "ioredis";
import { env } from "@/shared/config/env";
import { logger } from "@/infrastructure/logger/pino";

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "test";

// Singleton connection instances for pub and sub roles to avoid connection exhaustion
export const redisPublisher = isBuildPhase
  ? ({
      on: (event: string, handler: any) => {},
      off: (event: string, handler: any) => {},
      emit: (event: string, ...args: any[]) => {},
      publish: async () => 0,
      subscribe: async () => {},
      quit: async () => "OK",
    } as any)
  : new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

export const redisSubscriber = isBuildPhase
  ? ({
      on: (event: string, handler: any) => {},
      off: (event: string, handler: any) => {},
      emit: (event: string, ...args: any[]) => {},
      subscribe: async () => {},
      quit: async () => "OK",
    } as any)
  : new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

if (!isBuildPhase) {
  redisPublisher.on("connect", () => logger.info("Redis Publisher connected successfully"));
  redisPublisher.on("error", (err: any) => logger.error({ err }, "Redis Publisher connection error"));

  redisSubscriber.on("connect", () => logger.info("Redis Subscriber connected successfully"));
  redisSubscriber.on("error", (err: any) => logger.error({ err }, "Redis Subscriber connection error"));
}

