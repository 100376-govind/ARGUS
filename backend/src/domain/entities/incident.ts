export interface ReporterEntity {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaEntity {
  id: string;
  url: string;
  type: string;
  metadata?: any;
  incidentId?: string | null;
  createdAt: Date;
}

export interface ExtractedEntities {
  locations: string[];
  hazards: string[];
  people: string[];
  vehicles: string[];
  organizations: string[];
}

export interface AgentExecutionRecord {
  agentName: string;
  status: "success" | "failed";
  confidence: number;
  reasoning: string;
  outputData: any;
  timestamp: Date;
}

export interface AuditLogEntry {
  version: number;
  changedBy: string;
  action: string;
  timestamp: Date;
  changes: {
    field: string;
    from: any;
    to: any;
  }[];
}

export interface IncidentEntity {
  id: string;
  version: number;
  status: string;
  source: string;
  incidentType: string;
  rawContent: string;
  structuredDesc: string;
  confidence: number;
  lat?: number | null;
  lng?: number | null;
  locationName?: string | null;
  extractedEntities: ExtractedEntities;
  agentHistory: AgentExecutionRecord[];
  auditTrail: AuditLogEntry[];
  metadata?: any;
  tags: string[];
  reporterId?: string | null;
  reporter?: ReporterEntity | null;
  media?: MediaEntity[];
  createdAt: Date;
  updatedAt: Date;
}
