import {
  RiskAssessment,
  ThreatPrediction,
  SeverityHistory,
  PriorityHistory,
  ProtocolZeroRequest,
  ReasoningLog,
} from "../entities/risk-evaluator";

export interface IRiskAssessmentRepository {
  findByIncidentId(incidentId: string): Promise<RiskAssessment | null>;
  
  findById(id: string): Promise<RiskAssessment | null>;
  
  create(
    assessment: Omit<RiskAssessment, "id" | "createdAt" | "updatedAt" | "threatPredictions" | "severityHistory" | "priorityHistory" | "reasoningLogs" | "protocolZeroRequests">
  ): Promise<RiskAssessment>;
  
  update(
    id: string,
    updates: Partial<Omit<RiskAssessment, "id" | "incidentId" | "createdAt" | "updatedAt">>
  ): Promise<RiskAssessment>;
  
  addThreatPrediction(
    assessmentId: string,
    prediction: Omit<ThreatPrediction, "id" | "riskAssessmentId" | "createdAt">
  ): Promise<ThreatPrediction>;
  
  addSeverityHistory(
    assessmentId: string,
    history: Omit<SeverityHistory, "id" | "riskAssessmentId" | "createdAt">
  ): Promise<SeverityHistory>;
  
  addPriorityHistory(
    assessmentId: string,
    history: Omit<PriorityHistory, "id" | "riskAssessmentId" | "createdAt">
  ): Promise<PriorityHistory>;
  
  createProtocolZeroRequest(
    assessmentId: string,
    request: Omit<ProtocolZeroRequest, "id" | "riskAssessmentId" | "createdAt" | "updatedAt">
  ): Promise<ProtocolZeroRequest>;
  
  updateProtocolZeroRequest(
    requestId: string,
    updates: Partial<Omit<ProtocolZeroRequest, "id" | "riskAssessmentId" | "createdAt" | "updatedAt">>
  ): Promise<ProtocolZeroRequest>;
  
  logReasoning(
    assessmentId: string,
    log: Omit<ReasoningLog, "id" | "riskAssessmentId" | "createdAt">
  ): Promise<ReasoningLog>;

  findProtocolZeroRequestsByStatus(status: string): Promise<ProtocolZeroRequest[]>;
}
