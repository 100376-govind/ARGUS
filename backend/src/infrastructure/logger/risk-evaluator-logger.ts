import { logger } from "./pino";
import { SeverityLevel, PriorityLevel } from "@/domain/entities/risk-evaluator";

/**
 * Structured logger helpers for the Risk Evaluator Agent.
 */
export const riskLogger = {
  info: (message: string, metadata?: Record<string, any>) => {
    logger.info({ agent: "risk-evaluator", ...metadata }, message);
  },
  
  debug: (message: string, metadata?: Record<string, any>) => {
    logger.debug({ agent: "risk-evaluator", ...metadata }, message);
  },
  
  warn: (message: string, metadata?: Record<string, any>) => {
    logger.warn({ agent: "risk-evaluator", ...metadata }, message);
  },
  
  error: (message: string, error?: any, metadata?: Record<string, any>) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(
      {
        agent: "risk-evaluator",
        error: errorMessage,
        stack: errorStack,
        ...metadata,
      },
      message
    );
  },
  
  logEvaluationStart: (incidentId: string) => {
    logger.info(
      { agent: "risk-evaluator", incidentId, step: "evaluation_started" },
      `Risk Evaluator: Starting assessment for incident ${incidentId}`
    );
  },
  
  logEvaluationSuccess: (
    incidentId: string,
    assessmentId: string,
    severity: SeverityLevel,
    priority: PriorityLevel,
    overallScore: number
  ) => {
    logger.info(
      {
        agent: "risk-evaluator",
        incidentId,
        assessmentId,
        severity,
        priority,
        overallScore,
        step: "evaluation_completed",
      },
      `Risk Evaluator: Assessment successfully completed for incident ${incidentId}`
    );
  },
  
  logProtocolZeroTriggered: (incidentId: string, assessmentId: string, reason: string) => {
    logger.warn(
      {
        agent: "risk-evaluator",
        incidentId,
        assessmentId,
        reason,
        step: "protocol_zero_triggered",
      },
      `🔴 PROTOCOL ZERO TRIGGERED for incident ${incidentId} - Reason: ${reason}`
    );
  },
};
