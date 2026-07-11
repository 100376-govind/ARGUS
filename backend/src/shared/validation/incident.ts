import { z } from "zod";

export const reporterInputSchema = z.object({
  name: z.string().min(1, "Reporter name is required"),
  email: z.string().email("Invalid email format").optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.enum(["civilian", "operator", "first_responder", "sensor"]).default("civilian"),
});

export const incidentCreateTextSchema = z.object({
  rawContent: z.string().min(10, "Incident description must be at least 10 characters long"),
  reporter: reporterInputSchema.optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional().default([]),
});

export const incidentCreateWebhookSchema = z.object({
  source: z.string().min(1, "Webhook source name is required"),
  payload: z.record(z.any(), { message: "Payload must be a key-value object" }),
});

export const incidentCreateBulkSchema = z.object({
  incidents: z.array(incidentCreateTextSchema).min(1, "At least one incident is required for bulk dispatch"),
});

export const incidentUpdateSchema = z.object({
  status: z.enum(["pending", "in-progress", "dispatched", "resolved"]).optional(),
  incidentType: z.string().optional(),
  structuredDesc: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  locationName: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

// Gemini output response schema validation (structured output guarantee)
export const geminiIncidentResponseSchema = z.object({
  incidentType: z.string(),
  structuredDesc: z.string(),
  confidence: z.number(),
  locationName: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  extractedEntities: z.object({
    locations: z.array(z.string()).default([]),
    hazards: z.array(z.string()).default([]),
    people: z.array(z.string()).default([]),
    vehicles: z.array(z.string()).default([]),
    organizations: z.array(z.string()).default([]),
  }),
  reasoning: z.string(),
  tags: z.array(z.string()).default([]),
});
