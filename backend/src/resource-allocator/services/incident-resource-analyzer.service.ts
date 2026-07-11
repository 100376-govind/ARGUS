import { ResourceType } from "../interfaces/resource-allocator.interface";
import {
  ValidatedIncidentInput,
} from "../interfaces/resource-matching.interface";
import {
  resolveIncidentResourceMapping,
  VICTIM_QUANTITY_TIERS,
  HIGH_PRIORITY_RESOURCE_BOOST,
  IncidentResourceRequirement,
} from "../config/incident-resource-mapping.config";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";

/**
 * Output from the IncidentResourceAnalyzerService.
 */
export interface IncidentResourceAnalysis {
  incidentId: string;
  incidentType: string;
  /** Ordered list of resource types required by this incident. */
  requiredResources: ResourceType[];
  /** Per-type quantity breakdown. */
  resourceCount: Record<string, number>;
  /** Total resources needed across all types. */
  totalResourceCount: number;
  /** Priority classification for dispatch ordering. */
  priorityLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Human-readable resource labels from the mapping. */
  resourceLabels: Record<string, string>;
  /** The victim tier label used for quantity scaling. */
  victimTier: string;
  /** Whether a priority boost was applied. */
  priorityBoostApplied: boolean;
}

/**
 * IncidentResourceAnalyzerService
 *
 * Reads incident details from the validated incident input and determines
 * exactly which resources are required, in what quantity, and at what priority.
 *
 * Uses the configurable INCIDENT_RESOURCE_MAP and VICTIM_QUANTITY_TIERS
 * from the configuration layer — never hardcodes resource decisions.
 */
export class IncidentResourceAnalyzerService {
  private readonly logger = new ResourceMatchingLogger("IncidentResourceAnalyzer");

  /**
   * Analyzes a validated incident to determine required resources.
   *
   * @param incident - Validated incident input from Field Validator.
   * @returns Complete resource analysis with types, quantities, and priority.
   */
  public analyze(incident: ValidatedIncidentInput): IncidentResourceAnalysis {
    this.logger.info(
      `Incident Analyzed: ${incident.incidentId} (type=${incident.incidentType}, victims=${incident.estimatedVictims}, priority=${incident.priority})`
    );

    // 1. Resolve incident type → resource mapping
    const mapping = resolveIncidentResourceMapping(incident.incidentType);
    if (!mapping) {
      this.logger.warn(
        `No resource mapping found for incident type "${incident.incidentType}". Falling back to generic allocation.`
      );
      return this.buildFallbackAnalysis(incident);
    }

    // 2. Determine victim-based quantity tier
    const tier = this.resolveVictimTier(incident.estimatedVictims);

    // 3. Calculate per-type quantities
    const resourceCount = this.calculateQuantities(
      mapping,
      tier,
      incident.priority
    );

    // 4. Determine if priority boost was applied
    const priorityBoostApplied =
      incident.priority === "HIGH" || incident.priority === "CRITICAL";

    const totalResourceCount = Object.values(resourceCount).reduce(
      (sum, count) => sum + count,
      0
    );

    this.logger.info(
      `Resources Required: ${incident.incidentId} → ${JSON.stringify(resourceCount)} (tier=${tier.label}, boost=${priorityBoostApplied})`
    );

    return {
      incidentId: incident.incidentId,
      incidentType: incident.incidentType,
      requiredResources: mapping.requiredResourceTypes,
      resourceCount,
      totalResourceCount,
      priorityLevel: incident.priority,
      resourceLabels: mapping.resourceLabels,
      victimTier: tier.label,
      priorityBoostApplied,
    };
  }

  /**
   * Resolves the victim quantity tier based on estimated victim count.
   */
  private resolveVictimTier(estimatedVictims: number) {
    const victims = Math.max(0, estimatedVictims);
    for (const tier of VICTIM_QUANTITY_TIERS) {
      if (victims <= tier.maxVictims) {
        return tier;
      }
    }
    // Fallback to last tier
    return VICTIM_QUANTITY_TIERS[VICTIM_QUANTITY_TIERS.length - 1];
  }

  /**
   * Calculates per-resource-type quantities based on mapping, victim tier, and priority.
   */
  private calculateQuantities(
    mapping: IncidentResourceRequirement,
    tier: (typeof VICTIM_QUANTITY_TIERS)[number],
    priority: string
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    const isHighPriority = priority === "HIGH" || priority === "CRITICAL";

    for (const resourceType of mapping.requiredResourceTypes) {
      const baseCount = tier.baseQuantity[resourceType] ?? 1;
      const boostedCount = isHighPriority
        ? baseCount + HIGH_PRIORITY_RESOURCE_BOOST
        : baseCount;
      counts[resourceType] = boostedCount;
    }

    return counts;
  }

  /**
   * Builds a fallback analysis for unknown incident types.
   * Defaults to Ambulance + Police.
   */
  private buildFallbackAnalysis(
    incident: ValidatedIncidentInput
  ): IncidentResourceAnalysis {
    const fallbackTypes: ResourceType[] = ["Ambulance", "Police"];
    const resourceCount: Record<string, number> = {
      Ambulance: 1,
      Police: 1,
    };

    return {
      incidentId: incident.incidentId,
      incidentType: incident.incidentType,
      requiredResources: fallbackTypes,
      resourceCount,
      totalResourceCount: 2,
      priorityLevel: incident.priority,
      resourceLabels: {
        Ambulance: "Ambulance",
        Police: "Police Unit",
      },
      victimTier: "Minor",
      priorityBoostApplied: false,
    };
  }
}
