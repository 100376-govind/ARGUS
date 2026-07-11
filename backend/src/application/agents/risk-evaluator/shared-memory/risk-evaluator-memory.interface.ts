import { IncidentEntity } from "@/domain/entities/incident";
import { SeverityLevel, PriorityLevel } from "@/domain/entities/risk-evaluator";
import { ThreatPredictionDto } from "../dtos/risk-evaluation.dto";

export interface RiskEvaluatorExecutionOutput {
  status: "success" | "failed";
  confidence: number;
  reasoning: string;
  overallRiskScore: number;
  severity: SeverityLevel;
  priority: PriorityLevel;
  threatPredictions: ThreatPredictionDto[];
  isProtocolZeroTriggered: boolean;
  errorMessage?: string;
}

export interface IRiskEvaluatorSharedMemory {
  /**
   * Reads the current incident state from the Shared Incident Memory.
   * This provides the incident context populated by the Data Dispatcher.
   * 
   * @param incidentId The unique identifier of the incident
   * @returns The current IncidentEntity if found, or null
   */
  readIncidentContext(incidentId: string): Promise<IncidentEntity | null>;

  /**
   * Appends the Risk Evaluator's execution result and reasoning history to the
   * Shared Incident Memory.
   * 
   * This operation must safely append to the `agentHistory` list and updates the
   * Risk Assessment references, ensuring that all Data Dispatcher populated fields
   * (such as rawContent, structuredDesc, extractedEntities, and source) are strictly
   * preserved and never overwritten.
   * 
   * @param incidentId The unique identifier of the incident
   * @param output The Risk Evaluator's execution output
   * @returns The updated IncidentEntity
   */
  appendEvaluationResult(
    incidentId: string,
    output: RiskEvaluatorExecutionOutput
  ): Promise<IncidentEntity>;
}
