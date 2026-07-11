import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { DispatchPlanResult } from "../interfaces/dispatch-planner.interface";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";

/**
 * Handles persistence of Dispatch Plan results into Shared Incident Memory.
 */
export class RouteOptimizationSharedMemoryIntegration {
  private readonly logger = new ResourceMatchingLogger("RouteOptimizationSharedMemoryIntegration");

  constructor(private readonly sharedMemory: SharedIncidentMemory) {}

  /**
   * Appends Route Optimization and Dispatch Plan outputs to the Incident.
   */
  public async appendRouteOptimizationResult(
    incidentId: string,
    plan: DispatchPlanResult
  ): Promise<void> {
    const existing = await this.sharedMemory.read(incidentId);
    if (!existing) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const firstArrival = plan.dispatchOrder[0];
    const avgDistance = plan.dispatchOrder.reduce((sum, item) => sum + item.route.distanceKm, 0) / (plan.dispatchOrder.length || 1);

    await this.sharedMemory.write(incidentId, "route-optimization-engine", {
      status: "success",
      confidence: 95,
      reasoning: `Optimized route path created for ${plan.dispatchOrder.length} units. Nearest unit arrival at ${plan.estimatedArrival}.`,
      outputData: {
        type: "route-optimization",
        dispatchPlanId: plan.dispatchPlanId,
        dispatchPlan: plan.dispatchOrder.map(item => ({
          resourceId: item.resourceId,
          resourceName: item.resourceName,
          sequence: item.dispatchSequenceOrder,
          etaMinutes: item.route.durationMinutes,
          distanceKm: item.route.distanceKm,
          trafficDelayMinutes: item.route.trafficDelayMinutes,
          routeStatus: item.route.routeStatus,
        })),
        eta: firstArrival ? firstArrival.route.durationMinutes : 0,
        distance: parseFloat(avgDistance.toFixed(2)),
        routeStatus: firstArrival ? firstArrival.route.routeStatus : "Optimal",
        estimatedArrival: plan.estimatedArrival,
        timestamp: Date.now(),
      },
    });

    this.logger.info(`Shared Incident Memory updated with dispatch plan: ${plan.dispatchPlanId}`);
  }
}
