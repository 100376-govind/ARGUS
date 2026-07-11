import { TimelineEvent } from "../models/models";

export type ComplianceValidationStatus = "Complete" | "Incomplete" | "Needs Review";

export class ComplianceValidator {
  public static validateCompliance(events: TimelineEvent[]): ComplianceValidationStatus {
    const stages = events.map((e) => e.stage);
    const requiredStages = ["received", "evaluated", "validated", "allocated"];
    const missingStages = requiredStages.filter((s) => !stages.includes(s as any));

    // Check for failures or cancellations
    const hasIssues = events.some(
      (e) =>
        e.description.toLowerCase().includes("failed") ||
        e.description.toLowerCase().includes("cancelled") ||
        e.description.toLowerCase().includes("canceled") ||
        e.description.toLowerCase().includes("warning")
    );

    if (hasIssues) {
      return "Needs Review";
    }

    if (missingStages.length > 0) {
      return "Incomplete";
    }

    return "Complete";
  }
}
