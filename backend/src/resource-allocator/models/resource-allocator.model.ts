import { Allocation, AllocationStatus, ETA } from "../interfaces/resource-allocator.interface";

export class AllocationModel implements Allocation {
  public id: string;
  public incidentId: string;
  public resourceIds: string[];
  public status: AllocationStatus;
  public allocatedAt: Date;
  public updatedAt: Date;
  public etaMap: Record<string, ETA>;

  constructor(data: Omit<Allocation, "allocatedAt" | "updatedAt">) {
    this.id = data.id;
    this.incidentId = data.incidentId;
    this.resourceIds = data.resourceIds;
    this.status = data.status;
    this.allocatedAt = new Date();
    this.updatedAt = new Date();
    this.etaMap = data.etaMap;
  }

  /**
   * Updates the allocation status after validating correct transitions.
   */
  public updateStatus(newStatus: AllocationStatus): void {
    const allowedTransitions: Record<AllocationStatus, AllocationStatus[]> = {
      Pending: ["Confirmed", "Cancelled"],
      Confirmed: ["Completed", "Cancelled"],
      Cancelled: [],
      Completed: [],
    };

    const nextStates = allowedTransitions[this.status];
    if (!nextStates.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${this.status} to ${newStatus}`);
    }

    this.status = newStatus;
    this.updatedAt = new Date();
  }

  /**
   * Adds new resource to existing allocation.
   */
  public addResource(resourceId: string, eta: ETA): void {
    if (this.status !== "Pending" && this.status !== "Confirmed") {
      throw new Error(`Cannot add resources to allocation in ${this.status} state`);
    }
    if (!this.resourceIds.includes(resourceId)) {
      this.resourceIds.push(resourceId);
    }
    this.etaMap[resourceId] = eta;
    this.updatedAt = new Date();
  }
}
