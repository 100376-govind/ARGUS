import pino from "pino";
import { env } from "@/shared/config/env";

const isDev = env.NODE_ENV === "development";

export const logger = pino({
  level: isDev ? "debug" : "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      }
    : undefined,
});

export const logRequest = (method: string, url: string, ip?: string) => {
  logger.info({ method, url, ip }, `Incoming HTTP Request`);
};

export const logOperation = (serviceName: string, operation: string, metadata?: any) => {
  logger.debug({ serviceName, operation, ...metadata }, `Service Execution: ${serviceName}.${operation}`);
};

export const logEvent = (eventName: string, payload: any) => {
  logger.info({ eventName, payload }, `Event Published: ${eventName}`);
};

export const logError = (context: string, error: any) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error({ context, error: message, stack }, `Execution Error in [${context}]`);
};
