import { ValidatedIncidentInput, ResourceAllocationResult } from "../interfaces/resource-matching.interface";
import { RouteOptimizationService } from "./route-optimization.service";
import { DispatchPlanResult, DispatchPlanItem } from "../interfaces/dispatch-planner.interface";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";

/**
 * DispatchPlanner generates the final dispatch sequence and ETA predictions.
 */
export class DispatchPlanner {
  private readonly logger = new ResourceMatchingLogger("DispatchPlanner");

  constructor(private readonly routeOptimizationService: RouteOptimizationService) {}

  /**
   * Generates a detailed dispatch plan incorporating optimal dispatch sequences and overall travel ETAs.
   */
  public async generatePlan(
    allocation: ResourceAllocationResult,
    incident: ValidatedIncidentInput
  ): Promise<DispatchPlanResult> {
    this.logger.info(`Generating Dispatch Plan for Incident: ${incident.incidentId}`);

    const primaryFieldResources = allocation.primaryTeam.members;
    const optimizedPrimary = await this.routeOptimizationService.optimizeDispatchOrder(
      primaryFieldResources,
      incident.location
    );

    const dispatchOrder: DispatchPlanItem[] = optimizedPrimary.map((item, index) => ({
      resourceId: item.resource.id,
      resourceName: item.resource.name,
      resourceType: item.resource.type,
      dispatchSequenceOrder: index + 1,
      route: item.route,
    }));

    // Estimated arrival is when the first primary responder arrives
    const estimatedArrival = dispatchOrder.length > 0 
      ? dispatchOrder[0].route.estimatedArrivalTime 
      : new Date().toISOString();

    const plan: DispatchPlanResult = {
      dispatchPlanId: `PLAN-DISP-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      incidentId: incident.incidentId,
      dispatchOrder,
      primaryTeam: allocation.primaryTeam,
      backupTeam: allocation.backupTeam,
      hospitals: allocation.hospitals,
      shelters: allocation.shelters,
      estimatedArrival,
    };

    this.logger.info(`Dispatch Plan generated with ${dispatchOrder.length} items`);
    return plan;
  }
}
