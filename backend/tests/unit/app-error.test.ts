import { describe, it, expect } from "vitest";
import { AppError } from "@/shared/errors/app-error";

describe("AppError", () => {
  describe("static factory methods", () => {
    it("creates a validation error with 400 status", () => {
      const error = AppError.validation("Invalid email format");
      expect(error.statusCode).toBe(400);
      expect(error.errorCode).toBe("VALIDATION_ERROR");
      expect(error.message).toBe("Invalid email format");
    });

    it("creates a not-found error with 404 status", () => {
      const error = AppError.notFound("Incident", "INC-4092");
      expect(error.statusCode).toBe(404);
      expect(error.errorCode).toBe("NOT_FOUND");
      expect(error.message).toContain("INC-4092");
    });

    it("creates an unauthorized error with 401 status", () => {
      const error = AppError.unauthorized("Invalid token");
      expect(error.statusCode).toBe(401);
      expect(error.errorCode).toBe("UNAUTHORIZED");
    });

    it("creates a forbidden error with 403 status", () => {
      const error = AppError.forbidden("Insufficient permissions");
      expect(error.statusCode).toBe(403);
      expect(error.errorCode).toBe("FORBIDDEN");
    });

    it("creates an internal error with 500 status", () => {
      const error = AppError.internal("Database connection lost");
      expect(error.statusCode).toBe(500);
      expect(error.errorCode).toBe("INTERNAL_SERVER_ERROR");
    });

    it("creates a conflict error with 409 status", () => {
      const error = AppError.conflict("Incident already exists");
      expect(error.statusCode).toBe(409);
      expect(error.errorCode).toBe("CONFLICT");
    });
  });

  describe("instance behavior", () => {
    it("is an instance of Error", () => {
      const error = AppError.validation("test");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it("includes details when provided", () => {
      const details = { field: "email", constraint: "format" };
      const error = new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
      expect(error.details).toEqual(details);
    });

    it("serializes to JSON correctly", () => {
      const error = AppError.notFound("Incident", "INC-001");
      const json = JSON.parse(JSON.stringify(error));
      expect(json.statusCode).toBe(404);
      expect(json.errorCode).toBe("NOT_FOUND");
    });
  });
});
