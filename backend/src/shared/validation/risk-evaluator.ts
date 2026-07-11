import { z } from "zod";

export const severityLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const priorityLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const confidenceSchema = z
  .number()
  .min(0.0, "Confidence score must be at least 0.0")
  .max(1.0, "Confidence score must be at most 1.0");

export const threatPredictionSchema = z.object({
  threatType: z.string().min(1, "Threat type is required"),
  probability: z.number().min(0.0).max(1.0),
  impact: severityLevelSchema,
  estimatedTimeframe: z.string().min(1, "Estimated timeframe is required"),
  confidence: confidenceSchema,
});

export const incomingIncidentSchema = z.object({
  id: z.string().min(1, "Incident ID is required"),
  version: z.number().int().positive(),
  status: z.string().min(1, "Status is required"),
  source: z.string().min(1, "Source is required"),
  incidentType: z.string().min(1, "Incident type is required"),
  rawContent: z.string(),
  structuredDesc: z.string().min(1, "Structured description is required"),
  confidence: confidenceSchema,
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  locationName: z.string().optional().nullable(),
  extractedEntities: z.object({
    locations: z.array(z.string()),
    hazards: z.array(z.string()),
    people: z.array(z.string()),
    vehicles: z.array(z.string()),
    organizations: z.array(z.string()),
  }),
});

export const riskAssessmentValidationSchema = z.object({
  severity: severityLevelSchema,
  priority: priorityLevelSchema,
  overallRiskScore: z.number().min(0.0).max(100.0), // Assuming 0-100 scale
  confidence: confidenceSchema,
  reasoning: z.string().min(1, "Reasoning is required"),
  isProtocolZeroTriggered: z.boolean().default(false),
  threatPredictions: z.array(threatPredictionSchema),
});

export const protocolZeroRequestValidationSchema = z.object({
  reason: z.string().min(1, "Reason for Protocol Zero request is required"),
  requestedBy: z.string().min(1, "Requesting entity ID is required"),
});
