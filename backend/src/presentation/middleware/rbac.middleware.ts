import { NextRequest, NextResponse } from "next/server";
import { AuthenticationHooks, AuthenticatedUser } from "./auth.hooks";
import { GlobalExceptionHandler } from "./global-exception-handler";

type RouteHandlerWithUser = (
  req: NextRequest,
  user: AuthenticatedUser,
  context?: any
) => Promise<NextResponse>;

/**
 * Reusable middleware wrapper to enforce Role-Based Access Control (RBAC) 
 * on Next.js API Routes.
 */
export function withRoles(
  allowedRoles: ("Commander" | "Dispatcher" | "Admin")[],
  handler: RouteHandlerWithUser
) {
  return async (req: NextRequest, context?: any) => {
    try {
      // 1. Authenticate user
      const user = await AuthenticationHooks.authenticate(req);

      // 2. Authorize role
      AuthenticationHooks.authorize(user, allowedRoles);

      // 3. Delegate to handler passing the authenticated user profile
      return await handler(req, user, context);
    } catch (error) {
      return GlobalExceptionHandler.handle(error, req);
    }
  };
}
