import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/shared/errors/app-error";
import { logRequest, logError } from "@/infrastructure/logger/pino";
import { ZodError } from "zod";

type RouteHandler = (req: NextRequest, context?: any) => Promise<NextResponse>;

/**
 * Wraps a Next.js route handler with structured logging,
 * input sanitization, and centralized error handling.
 */
export function withHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context?: any) => {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    logRequest(req.method, req.url, ip);

    try {
      const response = await handler(req, context);
      return response;
    } catch (error) {
      if (error instanceof AppError) {
        logError(error.errorCode, error);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.errorCode,
              message: error.message,
              details: error.details,
            },
          },
          { status: error.statusCode }
        );
      }

      if (error instanceof ZodError) {
        logError("VALIDATION_ERROR", error);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              details: error.errors,
            },
          },
          { status: 400 }
        );
      }

      logError("UNHANDLED_ERROR", error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred",
          },
        },
        { status: 500 }
      );
    }
  };
}
