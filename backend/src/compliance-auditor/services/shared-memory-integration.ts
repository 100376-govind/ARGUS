import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { AuditEvent, TimelineEvent } from "../models/models";
import { logger } from "@/infrastructure/logger/pino";
import { ComplianceCache } from "./compliance-cache";

export class SharedMemoryIntegration {
  constructor(private readonly incidentRepo: IIncidentRepository) {}

  public async appendComplianceData(
    incidentId: string,
    data: {
      auditRecord?: AuditEvent;
      timelineEvent?: TimelineEvent;
      historyEvent?: any;
    }
  ): Promise<void> {
    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const metadata = incident.metadata || {};
    
    const auditRecords = Array.isArray((metadata as any).auditRecords) 
      ? [...(metadata as any).auditRecords] 
      : [];
    const timeline = Array.isArray((metadata as any).timeline) 
      ? [...(metadata as any).timeline] 
      : [];
    const eventHistory = Array.isArray((metadata as any).eventHistory) 
      ? [...(metadata as any).eventHistory] 
      : [];

    if (data.auditRecord) {
      auditRecords.push(data.auditRecord);
    }
    if (data.timelineEvent) {
      timeline.push(data.timelineEvent);
    }
    if (data.historyEvent) {
      eventHistory.push(data.historyEvent);
    }

    const updatedMetadata = {
      ...metadata,
      auditRecords,
      timeline,
      eventHistory,
    };

    await this.incidentRepo.update(
      incidentId,
      { metadata: updatedMetadata },
      "agent:compliance-auditor",
      "compliance_audit_append"
    );

    // Invalidate Cache
    await ComplianceCache.invalidate(`compliance:summary:${incidentId}`);
    await ComplianceCache.invalidate(`compliance:timeline:${incidentId}`);
    await ComplianceCache.invalidate(`compliance:report:${incidentId}`);

    logger.info({ incidentId }, "Compliance Auditor: Shared Memory Updated");
  }

  public async getComplianceData(incidentId: string): Promise<{
    auditRecords: AuditEvent[];
    timeline: TimelineEvent[];
    eventHistory: any[];
  }> {
    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) {
      return { auditRecords: [], timeline: [], eventHistory: [] };
    }

    const metadata = incident.metadata || {};
    return {
      auditRecords: Array.isArray((metadata as any).auditRecords) ? (metadata as any).auditRecords : [],
      timeline: Array.isArray((metadata as any).timeline) ? (metadata as any).timeline : [],
      eventHistory: Array.isArray((metadata as any).eventHistory) ? (metadata as any).eventHistory : [],
    };
  }

  public async writeComplianceState(
    incidentId: string,
    state: {
      eventLog?: any[];
      timeline?: any[];
      auditStatus?: string;
      executionHistory?: any[];
    }
  ): Promise<void> {
    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const metadata = incident.metadata || {};

    const existingEventLog = Array.isArray((metadata as any).eventLog) ? (metadata as any).eventLog : [];
    const existingTimeline = Array.isArray((metadata as any).timeline) ? (metadata as any).timeline : [];
    const existingExecutionHistory = Array.isArray((metadata as any).executionHistory) ? (metadata as any).executionHistory : [];

    const newEventLog = [...existingEventLog];
    if (state.eventLog) {
      for (const item of state.eventLog) {
        if (!newEventLog.some((e: any) => e.id === item.id || (e.action === item.action && e.agentName === item.agentName && e.timestamp === item.timestamp))) {
          newEventLog.push(item);
        }
      }
    }

    const newTimeline = [...existingTimeline];
    if (state.timeline) {
      for (const item of state.timeline) {
        if (!newTimeline.some((e: any) => e.id === item.id)) {
          newTimeline.push(item);
        }
      }
    }

    const newExecutionHistory = [...existingExecutionHistory];
    if (state.executionHistory) {
      for (const item of state.executionHistory) {
        newExecutionHistory.push(item);
      }
    }

    const updatedMetadata = {
      ...metadata,
      eventLog: newEventLog,
      timeline: newTimeline,
      auditStatus: state.auditStatus || (metadata as any).auditStatus || "Started",
      executionHistory: newExecutionHistory,
    };

    await this.incidentRepo.update(
      incidentId,
      { metadata: updatedMetadata },
      "agent:compliance-auditor",
      "compliance_audit_update_state"
    );

    // Invalidate Cache
    await ComplianceCache.invalidate(`compliance:summary:${incidentId}`);
    await ComplianceCache.invalidate(`compliance:timeline:${incidentId}`);
    await ComplianceCache.invalidate(`compliance:report:${incidentId}`);

    logger.info({ incidentId }, "Compliance Auditor: Shared Memory Updated");
  }

  public async writeReportState(
    incidentId: string,
    report: {
      sitrep: string;
      incidentSummary: string;
      decisionSummary: string;
      complianceStatus: string;
      recommendations: string[];
      reportTimestamp: Date;
    }
  ): Promise<void> {
    const incident = await this.incidentRepo.findById(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const metadata = incident.metadata || {};

    const updatedMetadata = {
      ...metadata,
      sitrep: report.sitrep,
      incidentSummary: report.incidentSummary,
      decisionSummary: report.decisionSummary,
      complianceStatus: report.complianceStatus,
      recommendations: report.recommendations,
      reportTimestamp: report.reportTimestamp,
    };

    await this.incidentRepo.update(
      incidentId,
      { metadata: updatedMetadata },
      "agent:compliance-auditor",
      "compliance_audit_write_report"
    );

    // Invalidate Cache
    await ComplianceCache.invalidate(`compliance:summary:${incidentId}`);
    await ComplianceCache.invalidate(`compliance:timeline:${incidentId}`);
    await ComplianceCache.invalidate(`compliance:report:${incidentId}`);

    logger.info({ incidentId }, "Compliance Auditor: Shared Memory Updated");
  }
}
