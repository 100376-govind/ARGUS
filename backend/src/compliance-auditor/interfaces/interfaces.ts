export interface AuditEntry {
  id: string;
  incidentId: string;
  agentName: string;
  timestamp: Date;
  status: string;
  details: any;
}

export interface AuditSummary {
  incidentId: string;
  totalEvents: number;
  complianceScore: number;
  status: string;
  startedAt: Date;
  updatedAt: Date;
}

export interface TimelineEntry {
  title: string;
  description: string;
  timestamp: Date;
  agentName: string;
  stage: "received" | "evaluated" | "validated" | "allocated" | "unknown";
}

export interface ComplianceStatus {
  isCompliant: boolean;
  missingStages: string[];
  remarks: string;
}

export interface ReportMetadata {
  generatedAt: Date;
  version: string;
  scope: string;
}
