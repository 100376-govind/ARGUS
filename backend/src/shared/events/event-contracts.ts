import { SeverityLevel, PriorityLevel } from "@/domain/entities/risk-evaluator";

export type RiskEventType =
  | "IncidentCreated"
  | "RiskEvaluationStarted"
  | "RiskEvaluated"
  | "RiskEvaluationFailed"
  | "CriticalIncidentDetected"
  | "ProtocolZeroRecommended"
  | "RiskUpdated";

export interface BaseEvent {
  eventId: string;
  eventType: RiskEventType;
  timestamp: string;
  correlationId: string;
}

export interface IncidentCreatedEvent extends BaseEvent {
  eventType: "IncidentCreated";
  data: {
    incidentId: string;
    incidentType: string;
    confidence: number;
    structuredDesc: string;
  };
}

export interface RiskEvaluationStartedEvent extends BaseEvent {
  eventType: "RiskEvaluationStarted";
  data: {
    incidentId: string;
  };
}

export interface RiskEvaluatedEvent extends BaseEvent {
  eventType: "RiskEvaluated";
  data: {
    incidentId: string;
    assessmentId: string;
    severity: SeverityLevel;
    priority: PriorityLevel;
    overallRiskScore: number;
    confidence: number;
    reasoning: string;
    isProtocolZeroTriggered: boolean;
  };
}

export interface RiskEvaluationFailedEvent extends BaseEvent {
  eventType: "RiskEvaluationFailed";
  data: {
    incidentId: string;
    errorCode: string;
    errorMessage: string;
  };
}

export interface CriticalIncidentDetectedEvent extends BaseEvent {
  eventType: "CriticalIncidentDetected";
  data: {
    incidentId: string;
    severity: SeverityLevel;
    overallRiskScore: number;
    reasoning: string;
  };
}

export interface ProtocolZeroRecommendedEvent extends BaseEvent {
  eventType: "ProtocolZeroRecommended";
  data: {
    incidentId: string;
    assessmentId: string;
    reason: string;
  };
}

export interface RiskUpdatedEvent extends BaseEvent {
  eventType: "RiskUpdated";
  data: {
    incidentId: string;
    assessmentId: string;
    severity: SeverityLevel;
    priority: PriorityLevel;
    reasoning: string;
    updatedBy: string;
  };
}
