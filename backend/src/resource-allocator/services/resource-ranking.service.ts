import { Location } from "../interfaces/resource-allocator.interface";
import {
  EnrichedResource,
  CapabilityScoreResult,
  RankedResource,
  ValidatedIncidentInput,
} from "../interfaces/resource-matching.interface";
import {
  RANKING_WEIGHTS,
  PRIORITY_MULTIPLIER,
} from "../config/matching-rules.config";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";

/**
 * ResourceRankingService produces a final composite rank for each resource
 * by combining:
 *   - Capability Score (45%)
 *   - Availability Weight (20%)
 *   - Distance Placeholder (15%)
 *   - Priority Weight (20%)
 *
 * Returns a sorted list of RankedResource entries, highest composite rank first.
 */
export class ResourceRankingService {
  private readonly logger = new ResourceMatchingLogger("ResourceRankingService");

  /**
   * Ranks enriched resources using capability scores and incident context.
   * Returns RankedResource[] sorted by compositeRank descending.
   */
  public rankResources(
    resources: EnrichedResource[],
    scores: CapabilityScoreResult[],
    incident: ValidatedIncidentInput
  ): RankedResource[] {
    const scoreMap = new Map<string, CapabilityScoreResult>();
    for (const score of scores) {
      scoreMap.set(score.resourceId, score);
    }

    const ranked: RankedResource[] = resources.map((resource) => {
      const scoreResult = scoreMap.get(resource.id);
      const capabilityScore = scoreResult?.totalScore ?? 0;

      const availabilityWeight = this.computeAvailabilityWeight(resource);
      const distancePlaceholder = this.computeDistancePlaceholder(
        resource.location,
        incident.location
      );
      const priorityWeight = this.computePriorityWeight(incident.priority);

      const compositeRank = this.computeCompositeRank(
        capabilityScore,
        availabilityWeight,
        distancePlaceholder,
        priorityWeight
      );

      const eta = this.computeETA(resource.location, incident.location);

      return {
        resource,
        capabilityScore,
        availabilityWeight,
        distancePlaceholder,
        priorityWeight,
        compositeRank,
        eta,
      };
    });

    ranked.sort((a, b) => b.compositeRank - a.compositeRank);

    this.logger.debug("Resource ranking complete", {
      incidentId: incident.incidentId,
      rankedCount: ranked.length,
      topRank: ranked.length > 0 ? ranked[0].compositeRank : 0,
      bottomRank: ranked.length > 0 ? ranked[ranked.length - 1].compositeRank : 0,
    });

    return ranked;
  }

  /**
   * Computes the availability weight for a resource.
   * Available resources get full weight (100).
   * This is designed to always return 100 since the AvailabilityChecker
   * has already filtered out unavailable resources.
   */
  private computeAvailabilityWeight(resource: EnrichedResource): number {
    return resource.status === "Available" ? 100 : 0;
  }

  /**
   * Computes a placeholder distance score (0–100).
   * Uses haversine approximation. Closer resources score higher.
   * This is a placeholder — real route optimization is out of scope for Phase 4.2.
   */
  private computeDistancePlaceholder(
    resourceLocation: Location,
    incidentLocation: Location
  ): number {
    const distanceKm = this.calculateHaversineDistance(
      resourceLocation,
      incidentLocation
    );

    if (distanceKm <= 1) return 100;
    if (distanceKm <= 5) return 85;
    if (distanceKm <= 10) return 70;
    if (distanceKm <= 20) return 55;
    if (distanceKm <= 35) return 40;
    if (distanceKm <= 50) return 25;
    return 10;
  }

  /**
   * Computes priority weight (0–100) based on the incident's priority level.
   */
  private computePriorityWeight(priority: string): number {
    const multiplier = PRIORITY_MULTIPLIER[priority] ?? 0.45;
    return Math.round(100 * multiplier);
  }

  /**
   * Computes the final composite rank using weighted combination.
   * All inputs are on a 0–100 scale; output is also 0–100.
   */
  private computeCompositeRank(
    capabilityScore: number,
    availabilityWeight: number,
    distancePlaceholder: number,
    priorityWeight: number
  ): number {
    const rawScore =
      capabilityScore * RANKING_WEIGHTS.capabilityScore +
      availabilityWeight * RANKING_WEIGHTS.availability +
      distancePlaceholder * RANKING_WEIGHTS.distance +
      priorityWeight * RANKING_WEIGHTS.priority;

    return parseFloat(Math.max(0, Math.min(100, rawScore)).toFixed(2));
  }

  /**
   * Computes estimated time of arrival using haversine distance.
   * Assumes average emergency vehicle speed of 50 km/h.
   */
  private computeETA(
    from: Location,
    to: Location
  ): { estimatedTimeMinutes: number; distanceKm: number } {
    const distanceKm = this.calculateHaversineDistance(from, to);
    const averageSpeedKmh = 50;
    const estimatedTimeMinutes = Math.max(
      1,
      Math.round((distanceKm / averageSpeedKmh) * 60)
    );

    return {
      estimatedTimeMinutes,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
    };
  }

  /**
   * Haversine formula for geodesic distance in kilometers.
   */
  private calculateHaversineDistance(loc1: Location, loc2: Location): number {
    const R = 6371;
    const dLat = this.toRadians(loc2.latitude - loc1.latitude);
    const dLon = this.toRadians(loc2.longitude - loc1.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(loc1.latitude)) *
        Math.cos(this.toRadians(loc2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
