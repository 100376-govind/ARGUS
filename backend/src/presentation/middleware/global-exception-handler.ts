import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/infrastructure/logger/pino";
import { StandardResponse } from "../responses/standard-response";
import {
  IncidentNotFoundError,
  InvalidIncidentError,
  GeminiFailureError,
  InvalidAiResponseError,
  PredictionFailureError,
  DatabaseError,
  RedisFailureError,
  SharedMemoryFailureError,
} from "@/shared/errors/risk-evaluator-service-errors";

export class GlobalExceptionHandler {
  /**
   * Catches errors from routes or controllers and converts them into standardized error payloads.
   */
  public static handle(error: any, req: NextRequest): NextResponse {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const requestId = req.headers.get("x-request-id") || `req-${Math.random().toString(36).substring(2, 11)}`;

    logger.error(
      {
        path: req.url,
        method: req.method,
        ip,
        requestId,
        errorName: error.name || "Error",
        errorMessage: error.message || "No error message provided",
        stack: error.stack,
      },
      "GlobalExceptionHandler: Intercepted exception"
    );

    // 1. Zod Validation Errors
    if (error instanceof ZodError) {
      const errorDetails = error.errors.map((e) => ({
        field: e.path.join("."),
        issue: e.message,
      }));
      return StandardResponse.error(
        errorDetails,
        "Request body validation failed",
        400,
        "VALIDATION_ERROR",
        requestId
      );
    }

    // 2. Custom Risk Evaluator Service Errors
    if (error instanceof IncidentNotFoundError) {
      return StandardResponse.error([error.message], error.message, 404, "INCIDENT_NOT_FOUND", requestId);
    }

    if (error instanceof InvalidIncidentError) {
      return StandardResponse.error([error.message], error.message, 400, "INVALID_INCIDENT", requestId);
    }

    if (error instanceof GeminiFailureError) {
      return StandardResponse.error(
        [error.message],
        "Gemini AI processing failed. Please check network/connectivity settings",
        502,
        "GEMINI_AI_FAILURE",
        requestId
      );
    }

    if (error instanceof InvalidAiResponseError) {
      return StandardResponse.error(
        [error.message],
        "Structured AI response parsing failed",
        422,
        "INVALID_AI_RESPONSE",
        requestId
      );
    }

    if (error instanceof PredictionFailureError) {
      return StandardResponse.error([error.message], error.message, 500, "PREDICTION_CALCULATION_ERROR", requestId);
    }

    if (error instanceof DatabaseError) {
      return StandardResponse.error(
        ["A database persistence error occurred. Please try again."],
        "Database Error",
        500,
        "DATABASE_FAILURE",
        requestId
      );
    }

    if (error instanceof RedisFailureError) {
      return StandardResponse.error(
        ["Failed to communicate with the cache/pub-sub cluster."],
        "Cache Error",
        500,
        "REDIS_FAILURE",
        requestId
      );
    }

    if (error instanceof SharedMemoryFailureError) {
      return StandardResponse.error(
        ["Could not read/update Shared Incident Memory context."],
        "Shared Memory Error",
        500,
        "SHARED_MEMORY_FAILURE",
        requestId
      );
    }

    // 3. Base App Error
    if (error instanceof AppError) {
      return StandardResponse.error(
        [error.message],
        error.message,
        error.statusCode,
        error.errorCode,
        requestId
      );
    }

    // 4. Default Unknown Errors
    const env = process.env.NODE_ENV || "development";
    const devMessage = error.message || "An unexpected system error occurred";
    const userMessage = env === "development" ? devMessage : "An unexpected server error occurred";

    return StandardResponse.error(
      [userMessage],
      "Internal Server Error",
      500,
      "INTERNAL_SERVER_ERROR",
      requestId
    );
  }
}

import { SecurityMiddleware } from "./security.middleware";

/**
 * Higher-order function wrapper to automatically route errors through the exception handler,
 * while enforcing CORS configuration, rate limits, and security headers.
 */
export function withErrorCatching(handler: (req: NextRequest, context?: any) => Promise<NextResponse>) {
  return async (req: NextRequest, context?: any) => {
    try {
      // 1. Enforce CORS preflight intercept
      if (req.method === "OPTIONS") {
        return SecurityMiddleware.handleCors(req, new NextResponse(null, { status: 204 }));
      }

      // 2. Perform Rate Limiting check
      await SecurityMiddleware.rateLimit(req);

      // 3. Execute route handler
      const response = await handler(req, context);

      // 4. Inject CORS and Security Headers
      SecurityMiddleware.handleCors(req, response);
      SecurityMiddleware.applySecurityHeaders(response);

      return response;
    } catch (error) {
      const errResponse = GlobalExceptionHandler.handle(error, req);
      SecurityMiddleware.handleCors(req, errResponse);
      SecurityMiddleware.applySecurityHeaders(errResponse);
      return errResponse;
    }
  };
}

