import { AuditRecord, AuditEvent, TimelineEvent, IncidentTimeline, AuditMetadata } from "../models/models";
import { SharedMemoryIntegration } from "./shared-memory-integration";
import { TimelineBuilder } from "../utils/timeline-builder";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { logger } from "@/infrastructure/logger/pino";

export class ComplianceAuditorService {
  private readonly sharedMemoryIntegration: SharedMemoryIntegration;

  constructor(private readonly incidentRepo: IIncidentRepository) {
    this.sharedMemoryIntegration = new SharedMemoryIntegration(incidentRepo);
  }

  public async createAudit(incidentId: string): Promise<AuditRecord> {
    logger.info({ incidentId }, "Compliance Auditor: Audit Started");
    
    // Check if incident exists
    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    // Build timeline
    const timeline = TimelineBuilder.buildTimeline(incident);

    // Initial audit metadata
    const metadata = new AuditMetadata(100, true, new Date());

    const record = new AuditRecord(
      incidentId,
      [],
      timeline,
      [],
      metadata,
      new Date(),
      new Date()
    );

    // Save initial audit timeline into shared memory
    for (const evt of timeline.events) {
      await this.sharedMemoryIntegration.appendComplianceData(incidentId, {
        timelineEvent: evt,
      });
    }

    return record;
  }

  public async appendEvent(incidentId: string, event: AuditEvent): Promise<void> {
    await this.sharedMemoryIntegration.appendComplianceData(incidentId, {
      auditRecord: event,
      historyEvent: {
        agentName: event.agentName,
        timestamp: event.timestamp,
        status: event.status,
        details: event.details,
      },
    });
    logger.info({ incidentId, eventId: event.id }, "Compliance Auditor: Event Recorded");
  }

  public async appendTimeline(incidentId: string, event: TimelineEvent): Promise<void> {
    await this.sharedMemoryIntegration.appendComplianceData(incidentId, {
      timelineEvent: event,
    });
    logger.info({ incidentId, eventId: event.id }, "Compliance Auditor: Timeline Updated");
  }

  public async getTimeline(incidentId: string): Promise<IncidentTimeline> {
    const data = await this.sharedMemoryIntegration.getComplianceData(incidentId);
    return new IncidentTimeline(incidentId, data.timeline);
  }

  public async getAudit(incidentId: string): Promise<AuditRecord | null> {
    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) return null;

    const data = await this.sharedMemoryIntegration.getComplianceData(incidentId);
    
    // Calculate compliance score based on present stages
    const stages = data.timeline.map((e) => e.stage);
    const requiredStages = ["received", "evaluated", "validated", "allocated"];
    const presentStages = requiredStages.filter((s) => stages.includes(s as any));
    const complianceScore = Math.round((presentStages.length / requiredStages.length) * 100);
    const isFullyCompliant = presentStages.length === requiredStages.length;

    const auditMetadata = new AuditMetadata(complianceScore, isFullyCompliant, new Date());

    return new AuditRecord(
      incidentId,
      data.auditRecords,
      new IncidentTimeline(incidentId, data.timeline),
      [],
      auditMetadata,
      incident.createdAt,
      incident.updatedAt
    );
  }

  /**
   * Helper to ingest agent output and map it to an AuditEvent and TimelineEvent.
   */
  public async ingestAgentOutput(
    incidentId: string,
    agentName: string,
    payload: {
      status: string;
      timestamp?: Date;
      priority?: string;
      validation?: any;
      resourceAllocation?: any;
    }
  ): Promise<void> {
    const timestamp = payload.timestamp || new Date();
    const eventId = `evt-${agentName}-${incidentId}-${timestamp.getTime()}`;
    
    const event = new AuditEvent(
      eventId,
      incidentId,
      agentName,
      timestamp,
      payload.status,
      {
        priority: payload.priority,
        validation: payload.validation,
        resourceAllocation: payload.resourceAllocation,
      }
    );

    await this.appendEvent(incidentId, event);

    // Build a timeline event for this stage
    let stage: TimelineEvent["stage"] = "unknown";
    let title = `${agentName} Processed`;
    let description = `Agent ${agentName} completed execution with status: ${payload.status}`;

    if (agentName === "data-dispatcher") {
      stage = "received";
      title = "Incident Received";
      description = `Incident normalized by Data Dispatcher. Status: ${payload.status}`;
    } else if (agentName === "risk-evaluator") {
      stage = "evaluated";
      title = "Risk Evaluated";
      description = `Risk evaluated. Priority: ${payload.priority}. Status: ${payload.status}`;
    } else if (agentName === "field-validator") {
      stage = "validated";
      title = "Incident Validated";
      description = `Incident validation completed. Result: ${JSON.stringify(payload.validation)}. Status: ${payload.status}`;
    } else if (agentName === "resource-allocator") {
      stage = "allocated";
      title = "Resources Allocated";
      description = `Resources allocated. Allocation: ${JSON.stringify(payload.resourceAllocation)}. Status: ${payload.status}`;
    }

    const timelineEvent = new TimelineEvent(
      `evt-timeline-${agentName}-${incidentId}-${timestamp.getTime()}`,
      stage,
      title,
      description,
      timestamp,
      agentName
    );

    await this.appendTimeline(incidentId, timelineEvent);
  }
}
