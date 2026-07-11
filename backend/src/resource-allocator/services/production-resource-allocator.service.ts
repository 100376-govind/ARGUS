import { resourceAllocatorCache } from "./resource-allocator-cache.service";
import { ResourceMatchingService } from "./resource-matching.service";
import { ResourceAllocatorService } from "./resource-allocator.service";
import { ResourceAllocatorSharedMemoryIntegration } from "./resource-allocator-memory.service";
import { ValidatedIncidentInput, ResourceAllocationResult } from "../interfaces/resource-matching.interface";
import { RouteOptimizationCoordinator } from "./route-optimization-coordinator.service";
import { CachedDistanceProvider } from "./cached-distance-provider.service";
import { RouteOptimizationSharedMemoryIntegration } from "./route-optimization-memory.service";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { incidentRepo } from "@/shared/container";
import { realtimeEventDispatcher } from "./realtime-event-dispatcher.service";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";
import { metrics } from "@/infrastructure/monitoring/metrics";

/**
 * Production-hardened orchestrator for the Resource Allocator.
 * Wraps caching, performance tracking, parallel execution, request deduplication, and error recovery.
 */
export class ProductionResourceAllocatorService {
  private readonly logger = new ResourceMatchingLogger("ProductionResourceAllocatorService");
  private readonly matchingService: ResourceMatchingService;
  private readonly routeCoordinator: RouteOptimizationCoordinator;
  private readonly sharedMemory: SharedIncidentMemory;
  private readonly matchingMemory: ResourceAllocatorSharedMemoryIntegration;
  private readonly routeMemory: RouteOptimizationSharedMemoryIntegration;

  // Track in-flight evaluations to deduplicate concurrent requests
  private readonly inFlightRequests = new Map<string, Promise<any>>();

  constructor(
    private readonly resourceService: ResourceAllocatorService
  ) {
    this.sharedMemory = new SharedIncidentMemory(incidentRepo);
    this.matchingMemory = new ResourceAllocatorSharedMemoryIntegration(this.sharedMemory);
    this.routeMemory = new RouteOptimizationSharedMemoryIntegration(this.sharedMemory);
    
    this.matchingService = new ResourceMatchingService(this.resourceService, this.matchingMemory);
    
    const cachedProvider = new CachedDistanceProvider();
    this.routeCoordinator = new RouteOptimizationCoordinator(cachedProvider, this.routeMemory);
  }

  /**
   * Process resource allocation with deduplication, caching, monitoring, and error recovery.
   */
  public async allocate(incident: ValidatedIncidentInput): Promise<any> {
    const incidentId = incident.incidentId;
    const startTime = performance.now();

    // 1. Request Deduplication
    if (this.inFlightRequests.has(incidentId)) {
      this.logger.info(`Deduplicating in-flight resource allocation request for incident ${incidentId}`);
      return this.inFlightRequests.get(incidentId);
    }

    const executionPromise = (async () => {
      try {
        // Broadcast allocation started
        await realtimeEventDispatcher.publishAllocationStarted(incidentId);

        // 2. Redis Cache Lookup
        const cachedPlan = await resourceAllocatorCache.get<any>("plan", incidentId);
        if (cachedPlan) {
          this.logger.info(`Cache HIT: Retrieved dispatch plan for incident ${incidentId}`);
          
          // Re-broadcast complete signals on cache hits
          await realtimeEventDispatcher.publishAllocationCompleted(incidentId, cachedPlan.allocation);
          await realtimeEventDispatcher.publishDispatchGenerated(incidentId, cachedPlan.dispatchPlan);
          await realtimeEventDispatcher.publishETAUpdated(incidentId, cachedPlan.eta);
          
          return cachedPlan;
        }

        // 3. Execution (Parallel fetching/matching/routing optimizations where applicable)
        // Match optimal resources
        const allocation = await this.matchingService.executeMatching(incident);
        await realtimeEventDispatcher.publishResourceMatched(incidentId, allocation.allocatedResources);

        // Route optimization
        const dispatchPlan = await this.routeCoordinator.executeRouteOptimization(allocation, incident);
        await realtimeEventDispatcher.publishDispatchGenerated(incidentId, dispatchPlan);

        // ETA updating
        const eta = dispatchPlan.dispatchOrder[0]?.route.durationMinutes ?? null;
        if (eta !== null) {
          await realtimeEventDispatcher.publishETAUpdated(incidentId, eta);
        }

        // Complete signal
        await realtimeEventDispatcher.publishAllocationCompleted(incidentId, allocation);

        const result = {
          incidentId,
          allocation,
          dispatchPlan,
          eta,
          status: "completed",
        };

        // Cache the completed result (TTL of 10 minutes)
        await resourceAllocatorCache.set("plan", incidentId, result, 600);

        // Record metrics
        const totalDuration = performance.now() - startTime;
        metrics.recordEvaluationTime(incidentId, totalDuration);

        return result;
      } catch (err: any) {
        this.logger.error(`Error during production allocation pipeline execution: ${err.message}`, err);
        throw err;
      } finally {
        // Cleanup in-flight tracker
        this.inFlightRequests.delete(incidentId);
      }
    })();

    this.inFlightRequests.set(incidentId, executionPromise);
    return executionPromise;
  }
}
