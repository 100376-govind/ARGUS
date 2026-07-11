import { SeverityLevel, PriorityLevel } from "@/domain/entities/risk-evaluator";

/**
 * Severity Level Constants
 */
export const Severity = {
  LOW: "LOW" as SeverityLevel,
  MEDIUM: "MEDIUM" as SeverityLevel,
  HIGH: "HIGH" as SeverityLevel,
  CRITICAL: "CRITICAL" as SeverityLevel,
} as const;

/**
 * Priority Level Constants
 */
export const Priority = {
  LOW: "LOW" as PriorityLevel,
  MEDIUM: "MEDIUM" as PriorityLevel,
  HIGH: "HIGH" as PriorityLevel,
  CRITICAL: "CRITICAL" as PriorityLevel,
} as const;

/**
 * Protocol Zero Request Status Constants
 */
export const ProtocolZeroStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

/**
 * Risk Assessment Score Thresholds (Scale: 0 - 100)
 */
export const RISK_SCORE_THRESHOLDS = {
  CRITICAL: 85.0,
  HIGH: 60.0,
  MEDIUM: 35.0,
  LOW: 0.0,
} as const;

/**
 * Protocol Zero Automation Configuration
 */
export const PROTOCOL_ZERO_CONFIG = {
  /**
   * Automatic trigger threshold. Overall risk scores equal to or above this
   * value will automatically flag isProtocolZeroTriggered as true.
   */
  AUTO_TRIGGER_THRESHOLD: 90.0,
  
  /**
   * Default requester identifier for automated system triggers.
   */
  SYSTEM_REQUESTER_ID: "agent:risk-evaluator:protocol-zero-engine",
} as const;

/**
 * Standard Threat Categories processed by the Threat Predictor sub-agent.
 */
export const THREAT_CATEGORIES = {
  STRUCTURAL_COLLAPSE: "structural_collapse",
  WILDFIRE_SPREAD: "wildfire_spread",
  TOXIC_LEAK: "toxic_leak",
  FLOODING: "flooding",
  CIVIL_UNREST: "civil_unrest",
  GRID_FAILURE: "grid_failure",
  HAZMAT_CONTAMINATION: "hazmat_contamination",
  OTHER: "other",
} as const;

/**
 * Configuration schema for the Risk Evaluator Agent.
 */
export interface RiskEvaluatorConfig {
  defaultConfidenceThreshold: number;
  enableAutoProtocolZero: boolean;
  minPredictionsCount: number;
}

export const riskEvaluatorConfig: RiskEvaluatorConfig = {
  defaultConfidenceThreshold: parseFloat(process.env.RISK_EVALUATOR_CONFIDENCE_THRESHOLD || "0.7"),
  enableAutoProtocolZero: process.env.ENABLE_AUTO_PROTOCOL_ZERO === "true" || true,
  minPredictionsCount: parseInt(process.env.RISK_EVALUATOR_MIN_PREDICTIONS || "1", 10),
};
