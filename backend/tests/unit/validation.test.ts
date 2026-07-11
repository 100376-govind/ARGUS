import { describe, it, expect } from "vitest";
import {
  incidentCreateTextSchema,
  incidentUpdateSchema,
  incidentCreateBulkSchema as incidentBulkSchema,
  incidentCreateWebhookSchema as webhookPayloadSchema,
} from "@/shared/validation/incident";



describe("Incident Zod Schemas", () => {
  // ─── incidentCreateTextSchema ───────────────────────

  describe("incidentCreateTextSchema", () => {
    it("accepts valid text input with all fields", () => {
      const input = {
        rawContent: "A massive wildfire has been reported near the downtown district. Multiple buildings on fire.",
        reporter: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+1-555-0100",
          role: "civilian",
        },
        metadata: { source: "web-form" },
        tags: ["wildfire", "downtown"],
      };
      const result = incidentCreateTextSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts minimal valid input (rawContent only)", () => {
      const input = { rawContent: "Flood warning: water level rising on Main Street bridge" };
      const result = incidentCreateTextSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects rawContent shorter than 10 characters", () => {
      const input = { rawContent: "short" };
      const result = incidentCreateTextSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("rawContent");
      }
    });

    it("rejects missing rawContent", () => {
      const input = {};
      const result = incidentCreateTextSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects invalid reporter email", () => {
      const input = {
        rawContent: "Earthquake detected in sector 7, magnitude 6.2",
        reporter: {
          name: "Jane Doe",
          email: "not-an-email",
        },
      };
      const result = incidentCreateTextSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  // ─── incidentUpdateSchema ──────────────────────────

  describe("incidentUpdateSchema", () => {
    it("accepts valid status update", () => {
      const input = { status: "in-progress" };
      const result = incidentUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts multiple fields", () => {
      const input = {
        status: "dispatched",
        incidentType: "flood",
        tags: ["urgent", "critical"],
      };
      const result = incidentUpdateSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts empty object (no required fields)", () => {
      const result = incidentUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  // ─── incidentBulkSchema ────────────────────────────

  describe("incidentBulkSchema", () => {
    it("accepts valid bulk input", () => {
      const input = {
        incidents: [
          { rawContent: "Chemical spill on Highway 101 northbound near exit 23" },
          { rawContent: "Structure collapse at 456 Oak Avenue, possible trapped survivors" },
        ],
      };
      const result = incidentBulkSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects empty incidents array", () => {
      const input = { incidents: [] };
      const result = incidentBulkSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects bulk with invalid item", () => {
      const input = {
        incidents: [
          { rawContent: "Valid content here for first incident report" },
          { rawContent: "short" }, // too short
        ],
      };
      const result = incidentBulkSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  // ─── webhookPayloadSchema ──────────────────────────

  describe("webhookPayloadSchema", () => {
    it("accepts valid webhook payload", () => {
      const input = {
        source: "twilio",
        payload: {
          CallSid: "CA123",
          From: "+15551234",
          Body: "Emergency at 123 Main St",
        },
      };
      const result = webhookPayloadSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects missing source", () => {
      const input = { payload: { data: "test" } };
      const result = webhookPayloadSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects missing payload", () => {
      const input = { source: "pagerduty" };
      const result = webhookPayloadSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
