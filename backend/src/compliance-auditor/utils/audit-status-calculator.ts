export type AuditStatus = "Started" | "Processing" | "Completed" | "Failed" | "Cancelled";

export class AuditStatusCalculator {
  public static calculateStatus(events: Array<{ stage: string; status: string }>): AuditStatus {
    // 1. Check for failed status
    const hasFailed = events.some((e) => e.status.toLowerCase() === "failed");
    if (hasFailed) return "Failed";

    // 2. Check for cancelled status
    const hasCancelled = events.some((e) => e.status.toLowerCase() === "cancelled" || e.status.toLowerCase() === "canceled");
    if (hasCancelled) return "Cancelled";

    // 3. Extract stages
    const stages = events.map((e) => e.stage);
    const requiredStages = ["received", "evaluated", "validated", "allocated"];
    const completedStages = requiredStages.filter((s) => stages.includes(s));

    if (completedStages.length === requiredStages.length) {
      return "Completed";
    }

    if (completedStages.length > 1) {
      return "Processing";
    }

    return "Started";
  }
}
