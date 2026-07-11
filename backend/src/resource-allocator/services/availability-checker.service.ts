import { Resource, ResourceStatus } from "../interfaces/resource-allocator.interface";
import {
  EnrichedResource,
  UnavailableStatus,
} from "../interfaces/resource-matching.interface";
import { RESOURCE_ENRICHMENT_MAP } from "../config/matching-rules.config";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";

/**
 * AvailabilityChecker filters resources based on their operational status.
 *
 * Only resources with status "Available" pass through.
 * Resources with status "Busy", "Offline", or "Maintenance" are excluded.
 *
 * Additionally enriches each passing resource with capability metadata
 * from the enrichment configuration map.
 */
export class AvailabilityChecker {
  private readonly logger = new ResourceMatchingLogger("AvailabilityChecker");

  /**
   * Statuses that disqualify a resource from selection.
   */
  private static readonly EXCLUDED_STATUSES: ReadonlySet<string> = new Set<UnavailableStatus | ResourceStatus>([
    "Busy",
    "Offline",
    "Maintenance",
    "Reserved",
    "Deployed",
  ]);

  /**
   * The only status that qualifies a resource for matching.
   */
  private static readonly AVAILABLE_STATUS: ResourceStatus = "Available";

  /**
   * Filters a list of resources to only those that are operationally available,
   * then enriches each with capability metadata.
   */
  public filterAvailable(resources: Resource[]): EnrichedResource[] {
    const totalBefore = resources.length;

    const available = resources.filter((resource) =>
      this.isAvailable(resource)
    );

    const enriched = available.map((resource) => this.enrichResource(resource));

    this.logger.debug("Availability filtering complete", {
      totalResources: totalBefore,
      availableCount: enriched.length,
      excludedCount: totalBefore - enriched.length,
    });

    return enriched;
  }

  /**
   * Checks whether a single resource is available for dispatch.
   */
  public isAvailable(resource: Resource): boolean {
    return resource.status === AvailabilityChecker.AVAILABLE_STATUS;
  }

  /**
   * Checks whether a resource has an excluded status.
   */
  public isExcluded(resource: Resource): boolean {
    return AvailabilityChecker.EXCLUDED_STATUSES.has(resource.status);
  }

  /**
   * Enriches a base Resource with capability metadata from the enrichment map.
   * If no enrichment data exists for the resource, default neutral values are applied.
   */
  private enrichResource(resource: Resource): EnrichedResource {
    const enrichment = RESOURCE_ENRICHMENT_MAP[resource.id];

    if (enrichment) {
      return {
        ...resource,
        responderSkill: enrichment.responderSkill,
        vehicleType: enrichment.vehicleType,
        medicalCapability: enrichment.medicalCapability,
        rescueCapability: enrichment.rescueCapability,
      };
    }

    return {
      ...resource,
      responderSkill: "BasicFirstAid",
      vehicleType: "UtilityVan",
      medicalCapability: "None",
      rescueCapability: "None",
    };
  }
}
