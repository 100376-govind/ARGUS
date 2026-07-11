import { IncidentEntity, ReporterEntity, MediaEntity } from "../entities/incident";

export interface IIncidentRepository {
  findById(id: string): Promise<IncidentEntity | null>;
  findAll(filters?: {
    status?: string;
    incidentType?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<IncidentEntity[]>;
  create(incident: Omit<IncidentEntity, "createdAt" | "updatedAt">): Promise<IncidentEntity>;
  update(id: string, updates: Partial<IncidentEntity>, changedBy: string, actionName: string): Promise<IncidentEntity>;
  delete(id: string): Promise<boolean>;

  // Helper associations
  createReporter(reporter: Omit<ReporterEntity, "createdAt" | "updatedAt">): Promise<ReporterEntity>;
  findReporterById(id: string): Promise<ReporterEntity | null>;
  addMedia(media: Omit<MediaEntity, "createdAt">): Promise<MediaEntity>;
  logAgentExecution(execution: {
    agentName: string;
    incidentId: string;
    status: "success" | "failed";
    confidence: number;
    reasoning: string;
    outputData: any;
    errorMessage?: string;
    startedAt: Date;
    completedAt: Date;
  }): Promise<void>;
}
