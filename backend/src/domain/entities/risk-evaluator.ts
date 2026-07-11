export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ProtocolZeroStatus = "pending" | "approved" | "rejected";

export interface SeverityScore {
  level: SeverityLevel;
  score: number; // 0.0 - 1.0 or 0 - 100
  reasoning: string;
}

export interface PriorityScore {
  level: PriorityLevel;
  score: number; // 0.0 - 1.0 or 0 - 100
  reasoning: string;
}

export interface Prediction {
  threatType: string;
  probability: number; // 0.0 - 1.0
  impact: SeverityLevel;
  estimatedTimeframe: string; // e.g., "15m", "1h", "immediate"
  confidence: number; // 0.0 - 1.0
}

export interface ThreatPrediction extends Prediction {
  id: string;
  riskAssessmentId: string;
  createdAt: Date;
}

export interface SeverityHistory {
  id: string;
  riskAssessmentId: string;
  severity: SeverityLevel;
  score: number;
  reason: string;
  changedBy: string;
  createdAt: Date;
}

export interface PriorityHistory {
  id: string;
  riskAssessmentId: string;
  priority: PriorityLevel;
  score: number;
  reason: string;
  changedBy: string;
  createdAt: Date;
}

export interface ProtocolZeroRequest {
  id: string;
  riskAssessmentId: string;
  status: ProtocolZeroStatus;
  requestedBy: string;
  reason: string;
  approvedBy?: string | null;
  actionedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReasoningLog {
  id: string;
  riskAssessmentId: string;
  agentName: string;
  inputPayload: Record<string, any>;
  outputPayload: Record<string, any>;
  confidence: number;
  reasoning: string;
  createdAt: Date;
}

export interface RiskAssessment {
  id: string;
  incidentId: string;
  severity: SeverityLevel;
  priority: PriorityLevel;
  overallRiskScore: number;
  confidence: number;
  reasoning: string;
  isProtocolZeroTriggered: boolean;
  threatPredictions?: ThreatPrediction[];
  severityHistory?: SeverityHistory[];
  priorityHistory?: PriorityHistory[];
  reasoningLogs?: ReasoningLog[];
  protocolZeroRequests?: ProtocolZeroRequest[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskEvaluationRequest {
  incidentId: string;
}

export interface RiskEvaluationResponse {
  incidentId: string;
  riskAssessment: RiskAssessment;
}
