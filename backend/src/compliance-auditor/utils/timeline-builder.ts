import { TimelineEvent, IncidentTimeline } from "../models/models";
import { IncidentEntity } from "@/domain/entities/incident";

export class TimelineBuilder {
  public static buildTimeline(incident: IncidentEntity): IncidentTimeline {
    const events: TimelineEvent[] = [];

    // 1. Check for creation/received stage
    events.push(
      new TimelineEvent(
        `evt-rec-${incident.id}`,
        "received",
        "Incident Received",
        `Incident reported via ${incident.source} source. Initial type: ${incident.incidentType}.`,
        new Date(incident.createdAt || new Date()),
        "data-dispatcher"
      )
    );

    // 2. Scan agentHistory for subsequent stages
    if (Array.isArray(incident.agentHistory)) {
      for (const history of incident.agentHistory) {
        const timestamp = new Date(history.timestamp);
        
        if (history.agentName === "risk-evaluator") {
          events.push(
            new TimelineEvent(
              `evt-eval-${incident.id}-${timestamp.getTime()}`,
              "evaluated",
              "Risk Evaluated",
              `Risk assessment completed with status: ${history.status}. Reasoning: ${history.reasoning}`,
              timestamp,
              history.agentName
            )
          );
        } else if (history.agentName === "field-validator") {
          events.push(
            new TimelineEvent(
              `evt-val-${incident.id}-${timestamp.getTime()}`,
              "validated",
              "Incident Validated",
              `Field validation completed with status: ${history.status}. Reasoning: ${history.reasoning}`,
              timestamp,
              history.agentName
            )
          );
        } else if (history.agentName === "resource-allocator") {
          events.push(
            new TimelineEvent(
              `evt-alloc-${incident.id}-${timestamp.getTime()}`,
              "allocated",
              "Resources Allocated",
              `Resource allocation completed with status: ${history.status}. Reasoning: ${history.reasoning}`,
              timestamp,
              history.agentName
            )
          );
        } else {
          events.push(
            new TimelineEvent(
              `evt-gen-${incident.id}-${history.agentName}-${timestamp.getTime()}`,
              "unknown",
              `Agent ${history.agentName} Completed`,
              `Execution details: status ${history.status}. Reasoning: ${history.reasoning}`,
              timestamp,
              history.agentName
            )
          );
        }
      }
    }

    // Sort events chronologically by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return new IncidentTimeline(incident.id, events);
  }
}
