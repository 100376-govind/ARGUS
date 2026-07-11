import { NextRequest, NextResponse } from "next/server";
import { redisPublisher } from "@/infrastructure/redis/redis-client";
import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/infrastructure/logger/pino";

export class SecurityMiddleware {
  /**
   * Applies standard security headers to Next.js Response.
   */
  public static applySecurityHeaders(res: NextResponse): NextResponse {
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("X-XSS-Protection", "1; mode=block");
    res.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';"
    );
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    return res;
  }

  /**
   * Handles Cross-Origin Resource Sharing (CORS) preflight and response headers.
   */
  public static handleCors(req: NextRequest, res?: NextResponse): NextResponse {
    const origin = req.headers.get("origin") || "*";
    const response = res || NextResponse.next();

    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Request-ID");
    response.headers.set("Access-Control-Max-Age", "86400"); // 24 hours

    return response;
  }

  /**
   * Performs high-performance Redis-backed rate limiting per IP address.
   */
  public static async rateLimit(req: NextRequest, maxRequests: number = 100, windowSeconds: number = 60): Promise<void> {
    try {
      if (typeof redisPublisher.incr !== "function") {
        return; // Skip rate limiting in mock/build environments
      }

      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown-ip";
      const key = `rate_limit:${ip}`;

      const current = await redisPublisher.incr(key);
      if (current === 1) {
        await redisPublisher.expire(key, windowSeconds);
      }

      if (current > maxRequests) {
        logger.warn({ ip, current, maxRequests }, "SecurityMiddleware: Rate limit exceeded");
        throw new AppError(429, "TOO_MANY_REQUESTS", "Rate limit exceeded. Please try again later.");
      }
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ error: err.message }, "SecurityMiddleware: Rate limiting check failed");
    }
  }

  /**
   * Recursively sanitizes user input parameters to neutralize XSS payload injections.
   */
  public static sanitize<T>(data: T): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === "string") {
      // Escape HTML tags to protect from cross-site scripts (XSS)
      return data
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;") as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item)) as unknown as T;
    }

    if (typeof data === "object") {
      const sanitizedObj: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitizedObj[key] = this.sanitize(value);
      }
      return sanitizedObj as T;
    }

    return data;
  }
}
