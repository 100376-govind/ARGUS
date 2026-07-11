import { SharedMemoryIntegration } from "./shared-memory-integration";
import { TimelineSynchronizationService } from "./timeline-synchronization.service";
import { AuditStatusCalculator } from "../utils/audit-status-calculator";
import { TimelineEvent } from "../models/models";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { logger } from "@/infrastructure/logger/pino";

export interface TrackedEvent {
  id: string;
  incidentId: string;
  agentName: string;
  action: "Incident Received" | "Priority Assigned" | "Validation Completed" | "Resources Allocated" | "Dispatch Generated" | "Generic Execution";
  timestamp: Date;
  executionTime: number; // in ms
  status: "success" | "failed" | "cancelled" | "processing" | "started";
}

export class EventTrackingService {
  private readonly sharedMemoryIntegration: SharedMemoryIntegration;

  constructor(private readonly incidentRepo: IIncidentRepository) {
    this.sharedMemoryIntegration = new SharedMemoryIntegration(incidentRepo);
  }

  public async trackEvent(incidentId: string, event: Omit<TrackedEvent, "id">): Promise<void> {
    const timestamp = event.timestamp || new Date();
    const eventId = `evt-${event.agentName}-${event.action.replace(/\s+/g, "-").toLowerCase()}-${incidentId}-${timestamp.getTime()}`;
    const fullEvent: TrackedEvent = {
      id: eventId,
      ...event,
      timestamp,
    };

    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const metadata = incident.metadata || {};
    const existingEventLog = Array.isArray((metadata as any).eventLog) ? (metadata as any).eventLog : [];

    const isDuplicate = existingEventLog.some(
      (e: any) =>
        e.id === fullEvent.id ||
        (e.agentName === fullEvent.agentName &&
          e.action === fullEvent.action &&
          e.status === fullEvent.status &&
          Math.abs(new Date(e.timestamp).getTime() - fullEvent.timestamp.getTime()) < 1000)
    );

    if (isDuplicate) {
      logger.warn({ incidentId, agentName: event.agentName, action: event.action }, "Compliance Auditor: Duplicate event ignored.");
      return;
    }

    logger.info({ incidentId, agentName: event.agentName, action: event.action }, "Compliance Auditor: Event Captured");

    let stage: TimelineEvent["stage"] = "unknown";
    if (event.action === "Incident Received") stage = "received";
    else if (event.action === "Priority Assigned") stage = "evaluated";
    else if (event.action === "Validation Completed") stage = "validated";
    else if (event.action === "Resources Allocated" || event.action === "Dispatch Generated") stage = "allocated";

    const timelineEvent = new TimelineEvent(
      `te-${fullEvent.id}`,
      stage,
      event.action,
      `Agent ${event.agentName} executed action: ${event.action}. Status: ${event.status}. Execution time: ${event.executionTime}ms.`,
      fullEvent.timestamp,
      event.agentName
    );

    const existingTimeline = Array.isArray((metadata as any).timeline) ? (metadata as any).timeline : [];
    const synchronizedTimeline = TimelineSynchronizationService.synchronizeTimeline([...existingTimeline, timelineEvent]);

    const calculatedStatus = AuditStatusCalculator.calculateStatus(
      synchronizedTimeline.map((t) => ({ stage: t.stage, status: event.status }))
    );

    await this.sharedMemoryIntegration.writeComplianceState(incidentId, {
      eventLog: [fullEvent],
      timeline: synchronizedTimeline,
      auditStatus: calculatedStatus,
      executionHistory: [
        {
          agentName: event.agentName,
          action: event.action,
          executionTime: event.executionTime,
          status: event.status,
          timestamp: fullEvent.timestamp,
        },
      ],
    });

    logger.info({ incidentId }, "Compliance Auditor: Timeline Updated");
    logger.info({ incidentId, status: calculatedStatus }, "Compliance Auditor: Audit Updated");
  }
}
