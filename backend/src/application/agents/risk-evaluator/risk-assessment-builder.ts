import {
  RiskAssessment,
  ThreatPrediction,
  SeverityLevel,
  PriorityLevel,
  SeverityHistory,
  PriorityHistory,
  ReasoningLog,
  ProtocolZeroRequest,
} from "@/domain/entities/risk-evaluator";

export class RiskAssessmentBuilder {
  private id: string = "";
  private incidentId: string = "";
  private severity: SeverityLevel = "LOW";
  private priority: PriorityLevel = "LOW";
  private overallRiskScore: number = 0;
  private confidence: number = 0;
  private reasoning: string = "";
  private isProtocolZeroTriggered: boolean = false;
  private threatPredictions: ThreatPrediction[] = [];
  private severityHistory: SeverityHistory[] = [];
  private priorityHistory: PriorityHistory[] = [];
  private reasoningLogs: ReasoningLog[] = [];
  private protocolZeroRequests: ProtocolZeroRequest[] = [];
  private metadata: any = {};
  private createdAt: Date = new Date();
  private updatedAt: Date = new Date();

  public setId(id: string): this {
    this.id = id;
    return this;
  }

  public setIncidentId(incidentId: string): this {
    this.incidentId = incidentId;
    return this;
  }

  public setSeverity(severity: SeverityLevel): this {
    this.severity = severity;
    return this;
  }

  public setPriority(priority: PriorityLevel): this {
    this.priority = priority;
    return this;
  }

  public setOverallRiskScore(overallRiskScore: number): this {
    this.overallRiskScore = overallRiskScore;
    return this;
  }

  public setConfidence(confidence: number): this {
    this.confidence = confidence;
    return this;
  }

  public setReasoning(reasoning: string): this {
    this.reasoning = reasoning;
    return this;
  }

  public setIsProtocolZeroTriggered(isProtocolZeroTriggered: boolean): this {
    this.isProtocolZeroTriggered = isProtocolZeroTriggered;
    return this;
  }

  public setThreatPredictions(threatPredictions: ThreatPrediction[]): this {
    this.threatPredictions = [...threatPredictions];
    return this;
  }

  public setSeverityHistory(severityHistory: SeverityHistory[]): this {
    this.severityHistory = [...severityHistory];
    return this;
  }

  public setPriorityHistory(priorityHistory: PriorityHistory[]): this {
    this.priorityHistory = [...priorityHistory];
    return this;
  }

  public setReasoningLogs(reasoningLogs: ReasoningLog[]): this {
    this.reasoningLogs = [...reasoningLogs];
    return this;
  }

  public setProtocolZeroRequests(protocolZeroRequests: ProtocolZeroRequest[]): this {
    this.protocolZeroRequests = [...protocolZeroRequests];
    return this;
  }

  public setMetadata(metadata: any): this {
    this.metadata = { ...metadata };
    return this;
  }

  public setTimestamps(createdAt: Date, updatedAt: Date): this {
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    return this;
  }

  /**
   * Finalizes the construction of the RiskAssessment entity.
   */
  public build(): RiskAssessment {
    if (!this.incidentId) {
      throw new Error("RiskAssessmentBuilder: incidentId is required to build a RiskAssessment");
    }

    return {
      id: this.id || `ra_${Math.random().toString(36).substring(2, 9)}`,
      incidentId: this.incidentId,
      severity: this.severity,
      priority: this.priority,
      overallRiskScore: this.overallRiskScore,
      confidence: this.confidence,
      reasoning: this.reasoning,
      isProtocolZeroTriggered: this.isProtocolZeroTriggered,
      threatPredictions: this.threatPredictions,
      severityHistory: this.severityHistory,
      priorityHistory: this.priorityHistory,
      reasoningLogs: this.reasoningLogs,
      protocolZeroRequests: this.protocolZeroRequests,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
