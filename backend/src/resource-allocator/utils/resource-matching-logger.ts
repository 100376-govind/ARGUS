import { logger } from "@/infrastructure/logger/pino";

/**
 * Structured logger for the Resource Matching Engine (Phase 4.2).
 * Follows the same pattern as RiskEvaluatorLogger and FieldValidatorLogger.
 */
export class ResourceMatchingLogger {
  private readonly agentName = "resource-matching-engine";

  constructor(private readonly context: string) {}

  public info(message: string, metadata?: Record<string, any>): void {
    logger.info(
      { agent: this.agentName, context: this.context, ...metadata },
      message
    );
  }

  public debug(message: string, metadata?: Record<string, any>): void {
    logger.debug(
      { agent: this.agentName, context: this.context, ...metadata },
      message
    );
  }

  public warn(message: string, metadata?: Record<string, any>): void {
    logger.warn(
      { agent: this.agentName, context: this.context, ...metadata },
      message
    );
  }

  public error(message: string, error?: Error | unknown, metadata?: Record<string, any>): void {
    const errorMessage = error instanceof Error ? error.message : String(error ?? "Unknown error");
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(
      {
        agent: this.agentName,
        context: this.context,
        error: errorMessage,
        stack: errorStack,
        ...metadata,
      },
      message
    );
  }

  public performance(operation: string, durationMs: number): void {
    logger.info(
      {
        agent: this.agentName,
        context: this.context,
        operation,
        durationMs: parseFloat(durationMs.toFixed(2)),
        step: "performance",
      },
      `${operation} completed in ${durationMs.toFixed(2)}ms`
    );
  }

  public logMatchingStarted(incidentId: string, incidentType: string): void {
    logger.info(
      {
        agent: this.agentName,
        incidentId,
        incidentType,
        step: "matching_started",
      },
      `Resource Matching Started for incident ${incidentId} [${incidentType}]`
    );
  }

  public logMatchingCompleted(
    incidentId: string,
    matchedCount: number,
    topScore: number,
    durationMs: number
  ): void {
    logger.info(
      {
        agent: this.agentName,
        incidentId,
        matchedCount,
        topScore,
        durationMs: parseFloat(durationMs.toFixed(2)),
        step: "matching_completed",
      },
      `Matching Completed for incident ${incidentId}: ${matchedCount} resources matched (top score: ${topScore})`
    );
  }

  public logAllocationGenerated(
    incidentId: string,
    allocationId: string,
    primaryTeamSize: number,
    backupTeamSize: number,
    resourceScore: number
  ): void {
    logger.info(
      {
        agent: this.agentName,
        incidentId,
        allocationId,
        primaryTeamSize,
        backupTeamSize,
        resourceScore,
        step: "allocation_generated",
      },
      `Allocation Generated: ${allocationId} for incident ${incidentId} (Primary: ${primaryTeamSize}, Backup: ${backupTeamSize}, Score: ${resourceScore})`
    );
  }

  public logSharedMemoryUpdated(incidentId: string, allocationId: string): void {
    logger.info(
      {
        agent: this.agentName,
        incidentId,
        allocationId,
        step: "shared_memory_updated",
      },
      `Shared Memory Updated for incident ${incidentId} with allocation ${allocationId}`
    );
  }
}
