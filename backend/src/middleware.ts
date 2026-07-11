import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Clerk Authentication Middleware for ARGUS Backend.
 *
 * Public routes (no auth required):
 * - /api/health (liveness/readiness probes)
 * - /api/incidents/webhook (external integrations use API keys, not Clerk)
 * - /api/docs (Swagger UI)
 *
 * All other /api/* routes require a valid Clerk session token.
 */

const isPublicRoute = createRouteMatcher([
  "/api/health(.*)",
  "/api/incidents/webhook(.*)",
  "/api/docs(.*)",
]);

const defaultMiddleware = (req: NextRequest) => {
  return NextResponse.next();
};

const isDevBypass = process.env.NODE_ENV === "development" && 
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("d29ya2luZy1jb2NrdG9v") || 
   process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("mock") ||
   process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("xxxxx"));

// Export clerkMiddleware or a bypass middleware in local development
export default isDevBypass
  ? defaultMiddleware
  : clerkMiddleware(async (auth: any, request: any) => {
      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    });


export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
