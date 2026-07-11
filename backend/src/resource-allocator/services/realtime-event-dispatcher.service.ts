import { socketGateway } from "@/infrastructure/sockets/socket-gateway";
import { eventBus } from "@/shared/container";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";
import { ResourceAllocationResult } from "../interfaces/resource-matching.interface";
import { DispatchPlanResult } from "../interfaces/dispatch-planner.interface";

/**
 * Handles real-time publishing of allocation & routing events over Socket.io and Redis.
 */
export class RealtimeEventDispatcher {
  private readonly logger = new ResourceMatchingLogger("RealtimeEventDispatcher");

  constructor() {}

  /**
   * Publishes AllocationStarted event.
   */
  public async publishAllocationStarted(incidentId: string): Promise<void> {
    this.logger.info(`Publishing AllocationStarted event for incident ${incidentId}`);
    
    // Broadcast via Socket.io
    const io = (socketGateway as any).io;
    if (io) {
      const payload = { incidentId, timestamp: new Date().toISOString() };
      io.of("/risk").emit("allocationStarted", payload);
      io.of("/risk").to(`incident:${incidentId}`).emit("incident:allocationStarted", payload);
      io.of("/risk").emit("dashboardUpdated", { incidentId, updateType: "allocationStarted" });
    }

    // Publish to Redis
    await eventBus.publish("AllocationStarted", { incidentId, timestamp: new Date().toISOString() });
  }

  /**
   * Publishes ResourceMatched event.
   */
  public async publishResourceMatched(incidentId: string, matchedResources: any[]): Promise<void> {
    this.logger.info(`Publishing ResourceMatched event for incident ${incidentId}`);
    
    const io = (socketGateway as any).io;
    if (io) {
      const payload = { incidentId, matchedCount: matchedResources.length, timestamp: new Date().toISOString() };
      io.of("/risk").emit("resourceMatched", payload);
      io.of("/risk").to(`incident:${incidentId}`).emit("incident:resourceMatched", payload);
      io.of("/risk").emit("dashboardUpdated", { incidentId, updateType: "resourceMatched" });
    }

    await eventBus.publish("ResourceMatched", { incidentId, matchedResources, timestamp: new Date().toISOString() });
  }

  /**
   * Publishes DispatchGenerated event.
   */
  public async publishDispatchGenerated(incidentId: string, plan: DispatchPlanResult): Promise<void> {
    this.logger.info(`Publishing DispatchGenerated event for incident ${incidentId}`);
    
    const io = (socketGateway as any).io;
    if (io) {
      const payload = { incidentId, planId: plan.dispatchPlanId, timestamp: new Date().toISOString() };
      io.of("/risk").emit("dispatchGenerated", payload);
      io.of("/risk").to(`incident:${incidentId}`).emit("incident:dispatchGenerated", payload);
      io.of("/risk").emit("dashboardUpdated", { incidentId, updateType: "dispatchGenerated" });
    }

    await eventBus.publish("DispatchUpdated", { incidentId, plan, timestamp: new Date().toISOString() });
  }

  /**
   * Publishes ETAUpdated event.
   */
  public async publishETAUpdated(incidentId: string, etaMinutes: number): Promise<void> {
    this.logger.info(`Publishing ETAUpdated event for incident ${incidentId}`);
    
    const io = (socketGateway as any).io;
    if (io) {
      const payload = { incidentId, etaMinutes, timestamp: new Date().toISOString() };
      io.of("/risk").emit("etaCalculated", payload);
      io.of("/risk").to(`incident:${incidentId}`).emit("incident:etaCalculated", payload);
      io.of("/risk").emit("dashboardUpdated", { incidentId, updateType: "etaCalculated" });
    }

    await eventBus.publish("ETAUpdated", { incidentId, etaMinutes, timestamp: new Date().toISOString() });
  }

  /**
   * Publishes AllocationCompleted event.
   */
  public async publishAllocationCompleted(incidentId: string, allocation: ResourceAllocationResult): Promise<void> {
    this.logger.info(`Publishing AllocationCompleted event for incident ${incidentId}`);
    
    const io = (socketGateway as any).io;
    if (io) {
      const payload = { incidentId, allocationId: allocation.allocationId, timestamp: new Date().toISOString() };
      io.of("/risk").emit("allocationCompleted", payload);
      io.of("/risk").to(`incident:${incidentId}`).emit("incident:allocationCompleted", payload);
      io.of("/risk").emit("dashboardUpdated", { incidentId, updateType: "allocationCompleted" });
    }

    await eventBus.publish("AllocationCompleted", { incidentId, allocation, timestamp: new Date().toISOString() });
  }
}

export const realtimeEventDispatcher = new RealtimeEventDispatcher();
