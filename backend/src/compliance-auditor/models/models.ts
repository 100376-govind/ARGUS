export class AuditEvent {
  constructor(
    public readonly id: string,
    public readonly incidentId: string,
    public readonly agentName: string,
    public readonly timestamp: Date,
    public readonly status: string,
    public readonly details: any
  ) {}
}

export class TimelineEvent {
  constructor(
    public readonly id: string,
    public readonly stage: "received" | "evaluated" | "validated" | "allocated" | "unknown",
    public readonly title: string,
    public readonly description: string,
    public readonly timestamp: Date,
    public readonly agentName: string
  ) {}
}

export class IncidentTimeline {
  constructor(
    public readonly incidentId: string,
    public readonly events: TimelineEvent[]
  ) {}
}

export class ActionLog {
  constructor(
    public readonly id: string,
    public readonly action: string,
    public readonly actor: string,
    public readonly timestamp: Date,
    public readonly details: any
  ) {}
}

export class AuditMetadata {
  constructor(
    public readonly complianceScore: number,
    public readonly isFullyCompliant: boolean,
    public readonly auditedAt: Date
  ) {}
}

export class AuditRecord {
  constructor(
    public readonly incidentId: string,
    public readonly events: AuditEvent[],
    public readonly timeline: IncidentTimeline,
    public readonly actionLogs: ActionLog[],
    public readonly metadata: AuditMetadata,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
