import { TimelineEvent } from "../models/models";

export class TimelineSynchronizationService {
  private static stagePriority: Record<string, number> = {
    received: 1,
    evaluated: 2,
    validated: 3,
    allocated: 4,
    unknown: 5,
  };

  public static synchronizeTimeline(events: TimelineEvent[]): TimelineEvent[] {
    const sorted = [...events];
    sorted.sort((a, b) => {
      const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      
      // Concurrency handling: order by stage priority
      const priorityA = this.stagePriority[a.stage] ?? 99;
      const priorityB = this.stagePriority[b.stage] ?? 99;
      return priorityA - priorityB;
    });

    return sorted;
  }
}
