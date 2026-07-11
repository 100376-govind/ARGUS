import { NextRequest } from "next/server";
import { AppError } from "@/shared/errors/app-error";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: "Commander" | "Dispatcher" | "Admin";
}

export class AuthenticationHooks {
  /**
   * Evaluates the Authorization header and extracts user profile data.
   * Integration point only; does not verify signatures.
   */
  public static async authenticate(req: NextRequest): Promise<AuthenticatedUser> {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Access token is missing or invalid");
    }

    const token = authHeader.substring(7);

    // Mock implementation for testing/integration
    if (token === "mock-admin-token") {
      return { userId: "user-admin-1", email: "admin@argus.gov", role: "Admin" };
    }
    if (token === "mock-commander-token") {
      return { userId: "user-comm-1", email: "commander@argus.gov", role: "Commander" };
    }
    if (token === "mock-dispatcher-token") {
      return { userId: "user-disp-1", email: "dispatcher@argus.gov", role: "Dispatcher" };
    }

    // Try to decode basic payload if JSON format
    try {
      const payloadBase64 = token.split(".")[1];
      if (payloadBase64) {
        const decoded = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8"));
        if (decoded.role && decoded.userId) {
          return {
            userId: decoded.userId,
            email: decoded.email || "user@argus.gov",
            role: decoded.role as any,
          };
        }
      }
    } catch {
      // fallback to unauthorized
    }

    // Default mock behavior if any token is present during development
    if (process.env.NODE_ENV !== "production") {
      return { userId: "dev-user-id", email: "dev@argus.gov", role: "Admin" };
    }

    throw new AppError(401, "UNAUTHORIZED", "Failed to parse authentication payload");
  }

  /**
   * Enforces that the user has one of the allowed roles.
   */
  public static authorize(user: AuthenticatedUser, allowedRoles: ("Commander" | "Dispatcher" | "Admin")[]): void {
    if (!allowedRoles.includes(user.role)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        `Access denied. Role '${user.role}' is not authorized. Required: [${allowedRoles.join(", ")}]`
      );
    }
  }
}
