import { SeverityLevel, PriorityLevel, ProtocolZeroStatus } from "@/domain/entities/risk-evaluator";

export interface RiskEvaluationRequestDto {
  incidentId: string;
}

export interface ThreatPredictionDto {
  threatType: string;
  probability: number;
  impact: SeverityLevel;
  estimatedTimeframe: string;
  confidence: number;
}

export interface RiskEvaluationResponseDto {
  incidentId: string;
  assessmentId: string;
  severity: SeverityLevel;
  priority: PriorityLevel;
  overallRiskScore: number;
  confidence: number;
  reasoning: string;
  isProtocolZeroTriggered: boolean;
  threatPredictions: ThreatPredictionDto[];
  timestamp: Date;
}

export interface ProtocolZeroRequestDto {
  reason: string;
  requestedBy: string;
}

export interface ProtocolZeroResponseDto {
  requestId: string;
  riskAssessmentId: string;
  status: ProtocolZeroStatus;
  requestedBy: string;
  reason: string;
  createdAt: Date;
}

export interface UpdateSeverityDto {
  severity: SeverityLevel;
  score: number;
  reason: string;
  changedBy: string;
}

export interface UpdatePriorityDto {
  priority: PriorityLevel;
  score: number;
  reason: string;
  changedBy: string;
}
