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
import { IncidentResourceAnalyzerService } from "./incident-resource-analyzer.service";

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
  private readonly incidentAnalyzer: IncidentResourceAnalyzerService;

  constructor(
    private readonly resourceService: ResourceAllocatorService,
    private readonly memoryIntegration?: ResourceAllocatorSharedMemoryIntegration
  ) {
    this.availabilityChecker = new AvailabilityChecker();
    this.capabilityScorer = new CapabilityScorer();
    this.rankingService = new ResourceRankingService();
    this.allocationBuilder = new AllocationBuilder();
    this.incidentAnalyzer = new IncidentResourceAnalyzerService();
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
      // STEP 0: Analyze the incident to determine required resources
      const analysis = this.incidentAnalyzer.analyze(incident);

      // Inject analyzed resource types into the incident so downstream
      // pipeline stages only consider relevant resource types.
      const enrichedIncident: ValidatedIncidentInput = {
        ...incident,
        requiredResources: analysis.requiredResources,
      };

      this.logger.info(
        `Resources Matched: ${incident.incidentId} → types=${analysis.requiredResources.join(",")} count=${analysis.totalResourceCount} tier=${analysis.victimTier}`
      );

      // STEP 1: Read available resources (filtered by analyzed types)
      const allResources = this.readResources(enrichedIncident);

      // STEP 2: Filter unavailable resources
      const availableResources =
        this.availabilityChecker.filterAvailable(allResources);

      if (availableResources.length === 0) {
        throw new Error(
          `No available resources found for incident ${enrichedIncident.incidentId} within search radius`
        );
      }

      this.logger.debug("Available resources identified", {
        incidentId: enrichedIncident.incidentId,
        totalResources: allResources.length,
        availableCount: availableResources.length,
      });

      // STEP 3: Score resources by capability
      const capabilityScores = this.capabilityScorer.scoreAll(
        availableResources,
        enrichedIncident
      );

      // Filter out resources below minimum threshold
      const qualifiedScores = capabilityScores.filter(
        (s) => s.totalScore >= MINIMUM_CAPABILITY_THRESHOLD
      );

      const qualifiedResources = availableResources.filter((resource) =>
        qualifiedScores.some((s) => s.resourceId === resource.id)
      );

      this.logger.debug("Capability scoring complete", {
        incidentId: enrichedIncident.incidentId,
        scoredCount: capabilityScores.length,
        qualifiedCount: qualifiedScores.length,
        filteredOut: capabilityScores.length - qualifiedScores.length,
      });

      // STEP 4: Rank resources
      const rankedResources = this.rankingService.rankResources(
        qualifiedResources,
        qualifiedScores,
        enrichedIncident
      );

      const matchDuration = performance.now() - startTime;
      this.logger.logMatchingCompleted(
        enrichedIncident.incidentId,
        rankedResources.length,
        rankedResources.length > 0 ? rankedResources[0].compositeRank : 0,
        matchDuration
      );

      // STEP 5: Generate allocation (with incident analysis context)
      const allocation = this.allocationBuilder.buildAllocation(
        rankedResources,
        enrichedIncident,
        analysis
      );

      this.logger.logAllocationGenerated(
        enrichedIncident.incidentId,
        allocation.allocationId,
        allocation.primaryTeam.members.length,
        allocation.backupTeam.members.length,
        allocation.resourceScore
      );

      this.logger.info(
        `Allocation Updated: ${enrichedIncident.incidentId} → allocationId=${allocation.allocationId} requiredTypes=${analysis.requiredResources.join(",")} allocated=${allocation.allocatedResources.length}`
      );

      // STEP 6: Append to Shared Incident Memory (if integration is available)
      if (this.memoryIntegration) {
        await this.memoryIntegration.appendAllocationResult(
          enrichedIncident.incidentId,
          allocation,
          analysis
        );
        this.logger.logSharedMemoryUpdated(
          enrichedIncident.incidentId,
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

  public getIncidentAnalyzer(): IncidentResourceAnalyzerService {
    return this.incidentAnalyzer;
  }
}
