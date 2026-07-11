import { Resource } from "../interfaces/resource-allocator.interface";
import {
  ValidatedIncidentInput,
  ResourceAllocationResult,
} from "../interfaces/resource-matching.interface";
import {
  MINIMUM_CAPABILITY_THRESHOLD,
  DEFAULT_SEARCH_RADIUS_KM,
} from "../config/matching-rules.config";
import { AvailabilityChecker } from "./availability-checker.service";
import { CapabilityScorer } from "./capability-scorer.service";
import { ResourceRankingService } from "./resource-ranking.service";
import { AllocationBuilder } from "./allocation-builder.service";
import { ResourceAllocatorSharedMemoryIntegration } from "./resource-allocator-memory.service";
import { ResourceAllocatorService } from "./resource-allocator.service";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";

/**
 * ResourceMatchingService is the main orchestrator for Phase 4.2.
 *
 * Receives a validated incident from the Field Validator and automatically
 * selects the most suitable resources through a multi-stage pipeline:
 *
 *   1. Read available resources
 *   2. Filter unavailable resources (AvailabilityChecker)
 *   3. Match resources by capability (CapabilityScorer)
 *   4. Rank resources (ResourceRankingService)
 *   5. Generate allocation (AllocationBuilder)
 *   6. Append to Shared Incident Memory
 */
export class ResourceMatchingService {
  private readonly logger = new ResourceMatchingLogger("ResourceMatchingService");
  private readonly availabilityChecker: AvailabilityChecker;
  private readonly capabilityScorer: CapabilityScorer;
  private readonly rankingService: ResourceRankingService;
  private readonly allocationBuilder: AllocationBuilder;

  constructor(
    private readonly resourceService: ResourceAllocatorService,
    private readonly memoryIntegration?: ResourceAllocatorSharedMemoryIntegration
  ) {
    this.availabilityChecker = new AvailabilityChecker();
    this.capabilityScorer = new CapabilityScorer();
    this.rankingService = new ResourceRankingService();
    this.allocationBuilder = new AllocationBuilder();
  }

  /**
   * Executes the full smart resource matching pipeline for a validated incident.
   *
   * @param incident - Validated incident input from the Field Validator.
   * @returns The complete ResourceAllocationResult.
   */
  public async executeMatching(
    incident: ValidatedIncidentInput
  ): Promise<ResourceAllocationResult> {
    const startTime = performance.now();

    this.logger.logMatchingStarted(incident.incidentId, incident.incidentType);

    try {
      // STEP 1: Read available resources
      const allResources = this.readResources(incident);

      // STEP 2: Filter unavailable resources
      const availableResources =
        this.availabilityChecker.filterAvailable(allResources);

      if (availableResources.length === 0) {
        throw new Error(
          `No available resources found for incident ${incident.incidentId} within search radius`
        );
      }

      this.logger.debug("Available resources identified", {
        incidentId: incident.incidentId,
        totalResources: allResources.length,
        availableCount: availableResources.length,
      });

      // STEP 3: Score resources by capability
      const capabilityScores = this.capabilityScorer.scoreAll(
        availableResources,
        incident
      );

      // Filter out resources below minimum threshold
      const qualifiedScores = capabilityScores.filter(
        (s) => s.totalScore >= MINIMUM_CAPABILITY_THRESHOLD
      );

      const qualifiedResources = availableResources.filter((resource) =>
        qualifiedScores.some((s) => s.resourceId === resource.id)
      );

      this.logger.debug("Capability scoring complete", {
        incidentId: incident.incidentId,
        scoredCount: capabilityScores.length,
        qualifiedCount: qualifiedScores.length,
        filteredOut: capabilityScores.length - qualifiedScores.length,
      });

      // STEP 4: Rank resources
      const rankedResources = this.rankingService.rankResources(
        qualifiedResources,
        qualifiedScores,
        incident
      );

      const matchDuration = performance.now() - startTime;
      this.logger.logMatchingCompleted(
        incident.incidentId,
        rankedResources.length,
        rankedResources.length > 0 ? rankedResources[0].compositeRank : 0,
        matchDuration
      );

      // STEP 5: Generate allocation
      const allocation = this.allocationBuilder.buildAllocation(
        rankedResources,
        incident
      );

      this.logger.logAllocationGenerated(
        incident.incidentId,
        allocation.allocationId,
        allocation.primaryTeam.members.length,
        allocation.backupTeam.members.length,
        allocation.resourceScore
      );

      // STEP 6: Append to Shared Incident Memory (if integration is available)
      if (this.memoryIntegration) {
        await this.memoryIntegration.appendAllocationResult(
          incident.incidentId,
          allocation
        );
        this.logger.logSharedMemoryUpdated(
          incident.incidentId,
          allocation.allocationId
        );
      }

      const totalDuration = performance.now() - startTime;
      this.logger.performance("executeMatching", totalDuration);

      return allocation;
    } catch (error) {
      this.logger.error(
        `Resource matching failed for incident ${incident.incidentId}`,
        error as Error,
        { incidentId: incident.incidentId }
      );
      throw error;
    }
  }

  /**
   * Reads resources from the ResourceAllocatorService.
   * If the incident has required resource types specified, filters to those types.
   * Otherwise, reads all resources within the default search radius.
   */
  private readResources(incident: ValidatedIncidentInput): Resource[] {
    const location = incident.location;

    if (
      incident.requiredResources &&
      incident.requiredResources.length > 0
    ) {
      return this.resourceService.findResources(
        location,
        DEFAULT_SEARCH_RADIUS_KM,
        incident.requiredResources
      );
    }

    return this.resourceService.findResources(
      location,
      DEFAULT_SEARCH_RADIUS_KM
    );
  }

  /**
   * Provides direct access to sub-services for testing and introspection.
   */
  public getAvailabilityChecker(): AvailabilityChecker {
    return this.availabilityChecker;
  }

  public getCapabilityScorer(): CapabilityScorer {
    return this.capabilityScorer;
  }

  public getRankingService(): ResourceRankingService {
    return this.rankingService;
  }

  public getAllocationBuilder(): AllocationBuilder {
    return this.allocationBuilder;
  }
}
