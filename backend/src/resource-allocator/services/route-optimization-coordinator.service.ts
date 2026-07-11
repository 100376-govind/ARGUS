import { ValidatedIncidentInput, ResourceAllocationResult } from "../interfaces/resource-matching.interface";
import { DispatchPlanResult } from "../interfaces/dispatch-planner.interface";
import { IDistanceProvider } from "../interfaces/route-optimization.interface";
import { RouteOptimizationService } from "./route-optimization.service";
import { DispatchPlanner } from "./dispatch-planner.service";
import { RouteOptimizationSharedMemoryIntegration } from "./route-optimization-memory.service";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";
import { MockDistanceProvider } from "./mock-distance-provider.service";

/**
 * Main coordinator service for Route Optimization & ETA calculations.
 */
export class RouteOptimizationCoordinator {
  private readonly logger = new ResourceMatchingLogger("RouteOptimizationCoordinator");
  private readonly routeService: RouteOptimizationService;
  private readonly planner: DispatchPlanner;

  constructor(
    distanceProvider: IDistanceProvider = new MockDistanceProvider(),
    private readonly memoryIntegration?: RouteOptimizationSharedMemoryIntegration
  ) {
    this.routeService = new RouteOptimizationService(distanceProvider);
    this.planner = new DispatchPlanner(this.routeService);
  }

  /**
   * Runs the complete route optimization, nearest resource selection, ETA mapping,
   * and planning flow, then writes the result to shared memory.
   */
  public async executeRouteOptimization(
    allocation: ResourceAllocationResult,
    incident: ValidatedIncidentInput
  ): Promise<DispatchPlanResult> {
    this.logger.info(`Starting Route Optimization for Incident ${incident.incidentId}`);
    
    // Nearest resource filtering (from allocated primary resources)
    const nearestResources = this.routeService.findNearestResources(allocation.primaryTeam.members);
    
    // Create new primary team using nearest resources
    const updatedPrimaryTeam = {
      ...allocation.primaryTeam,
      members: nearestResources,
    };

    const updatedAllocation = {
      ...allocation,
      primaryTeam: updatedPrimaryTeam,
    };

    // Calculate plan
    const plan = await this.planner.generatePlan(updatedAllocation, incident);
    this.logger.info(`Dispatch Plan Generated: ${plan.dispatchPlanId}`);

    if (this.memoryIntegration) {
      await this.memoryIntegration.appendRouteOptimizationResult(incident.incidentId, plan);
      this.logger.info("Shared memory updated successfully");
    }

    return plan;
  }

  public getRouteService(): RouteOptimizationService {
    return this.routeService;
  }

  public getPlanner(): DispatchPlanner {
    return this.planner;
  }
}
