import { z } from "zod";
import { severityLevelSchema, priorityLevelSchema, confidenceSchema } from "./risk-evaluator";

export const geminiThreatPredictionSchema = z.object({
  threatType: z.string().min(1, "Threat type is required"),
  probability: z.number().min(0.0).max(1.0),
  impact: severityLevelSchema,
  estimatedTimeframe: z.string().min(1, "Timeframe estimation is required"),
  confidence: confidenceSchema,
});

export const geminiRiskEvaluatorResponseSchema = z.object({
  severity: severityLevelSchema,
  priority: priorityLevelSchema,
  confidence: confidenceSchema, // 0.0 - 1.0
  incidentType: z.string().min(1, "Incident type is required"),
  predictions: z.array(geminiThreatPredictionSchema),
  reasoning: z.string().min(1, "Concise reasoning is required"),
  recommendedActions: z.array(z.string()).min(1, "At least one recommended action is required"),
  protocolZero: z.object({
    triggered: z.boolean(),
    reason: z.string(),
  }),
  metadata: z.record(z.any()).default({}),
});

export type GeminiRiskEvaluatorResponse = z.infer<typeof geminiRiskEvaluatorResponseSchema>;
export type GeminiThreatPrediction = z.infer<typeof geminiThreatPredictionSchema>;
