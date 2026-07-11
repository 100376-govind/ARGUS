import {
  RankedResource,
  TeamAssignment,
  HospitalAssignment,
  ShelterAssignment,
  ResourceAllocationResult,
  ValidatedIncidentInput,
} from "../interfaces/resource-matching.interface";
import {
  INCIDENT_MATCHING_RULES,
  MAX_TEAM_SIZE,
} from "../config/matching-rules.config";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";
import { IncidentResourceAnalysis } from "./incident-resource-analyzer.service";

/**
 * AllocationBuilder takes ranked resources and constructs the final
 * allocation output including:
 *   - Selected Resources (filtered by threshold)
 *   - Primary Team assignment
 *   - Backup Team assignment
 *   - Hospital assignments
 *   - Shelter assignments
 *   - Estimated capacity summary
 */
export class AllocationBuilder {
  private readonly logger = new ResourceMatchingLogger("AllocationBuilder");

  /**
   * Builds a complete ResourceAllocationResult from ranked resources.
   * When an IncidentResourceAnalysis is provided, enriches the output
   * with required/allocated/missing resource breakdowns.
   */
  public buildAllocation(
    rankedResources: RankedResource[],
    incident: ValidatedIncidentInput,
    analysis?: IncidentResourceAnalysis
  ): ResourceAllocationResult {
    const allocationId = this.generateAllocationId();

    const rule = this.findMatchingRule(incident.incidentType);
    const scaleFactor = rule?.scaleFactor ?? 1.0;
    const minimumResources = rule?.minimumResources ?? 2;

    const scaledMinimum = Math.ceil(minimumResources * scaleFactor);

    const fieldResources = rankedResources.filter(
      (r) =>
        r.resource.type !== "Hospital" && r.resource.type !== "Shelter"
    );
    const hospitalResources = rankedResources.filter(
      (r) => r.resource.type === "Hospital"
    );
    const shelterResources = rankedResources.filter(
      (r) => r.resource.type === "Shelter"
    );

    const selectedFieldResources = fieldResources.slice(
      0,
      Math.max(scaledMinimum, minimumResources)
    );

    const primaryTeam = this.buildTeam(
      selectedFieldResources,
      "Primary",
      MAX_TEAM_SIZE
    );

    const backupCandidates = fieldResources.slice(selectedFieldResources.length);
    const backupTeam = this.buildTeam(
      backupCandidates,
      "Backup",
      Math.ceil(MAX_TEAM_SIZE / 2)
    );

    const hospitals = this.buildHospitalAssignments(hospitalResources);
    const shelters = this.buildShelterAssignments(shelterResources);

    const allAllocated = [
      ...selectedFieldResources,
      ...backupCandidates.slice(0, backupTeam.members.length),
      ...hospitalResources,
      ...shelterResources,
    ];

    const estimatedCapacity = this.calculateEstimatedCapacity(
      allAllocated,
      hospitals,
      shelters
    );

    const resourceScore = this.calculateOverallResourceScore(
      selectedFieldResources,
      primaryTeam,
      backupTeam
    );

    const allocationTimestamp = new Date().toISOString();

    // Build incident-analysis-enriched fields
    const allocatedResourceTypes = [
      ...new Set(allAllocated.map((r) => r.resource.type)),
    ];

    const requiredResourcesList = analysis
      ? analysis.requiredResources
      : rule?.requiredResourceTypes ?? [];

    const missingResources = requiredResourcesList.filter(
      (reqType) => !allocatedResourceTypes.includes(reqType)
    );

    const dispatchPriority = analysis
      ? analysis.priorityLevel
      : incident.priority;

    const resourceRequirements = analysis
      ? {
          requiredTypes: analysis.requiredResources,
          requiredCounts: analysis.resourceCount,
          totalRequired: analysis.totalResourceCount,
          victimTier: analysis.victimTier,
          priorityBoostApplied: analysis.priorityBoostApplied,
          resourceLabels: analysis.resourceLabels,
        }
      : undefined;

    const result: ResourceAllocationResult = {
      allocationId,
      incidentId: incident.incidentId,
      incidentType: incident.incidentType,
      priority: incident.priority,
      allocatedResources: allAllocated,
      primaryTeam,
      backupTeam,
      hospitals,
      shelters,
      estimatedCapacity,
      resourceScore,
      allocationTimestamp,
      // Enriched fields from incident analysis
      requiredResourceTypes: requiredResourcesList,
      allocatedResourceTypes,
      missingResources,
      dispatchPriority,
      resourceRequirements,
    };

    this.logger.logAllocationGenerated(
      incident.incidentId,
      allocationId,
      primaryTeam.members.length,
      backupTeam.members.length,
      resourceScore
    );

    return result;
  }

  /**
   * Builds a team assignment from a subset of ranked resources.
   */
  private buildTeam(
    rankedResources: RankedResource[],
    role: "Primary" | "Backup",
    maxSize: number
  ): TeamAssignment {
    const members = rankedResources.slice(0, maxSize);

    const totalCapabilityScore =
      members.length > 0
        ? parseFloat(
            (
              members.reduce((sum, m) => sum + m.capabilityScore, 0) /
              members.length
            ).toFixed(2)
          )
        : 0;

    return {
      teamId: `TEAM-${role.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      teamRole: role,
      members,
      totalCapabilityScore,
    };
  }

  /**
   * Builds hospital assignments from ranked hospital resources.
   */
  private buildHospitalAssignments(
    hospitalResources: RankedResource[]
  ): HospitalAssignment[] {
    return hospitalResources.map((ranked) => {
      const meta = ranked.resource.metadata ?? {};
      return {
        resourceId: ranked.resource.id,
        name: ranked.resource.name,
        availableBeds: meta.availableBeds ?? 0,
        icuAvailable: meta.icuAvailable ?? false,
        specialties: meta.specialties ?? [],
        distanceKm: ranked.eta.distanceKm,
        etaMinutes: ranked.eta.estimatedTimeMinutes,
      };
    });
  }

  /**
   * Builds shelter assignments from ranked shelter resources.
   */
  private buildShelterAssignments(
    shelterResources: RankedResource[]
  ): ShelterAssignment[] {
    return shelterResources.map((ranked) => {
      const meta = ranked.resource.metadata ?? {};
      const capacity = meta.capacity ?? 0;
      const currentOccupancy = meta.currentOccupancy ?? 0;
      return {
        resourceId: ranked.resource.id,
        name: ranked.resource.name,
        capacity,
        currentOccupancy,
        remainingCapacity: Math.max(0, capacity - currentOccupancy),
        amenities: meta.amenities ?? [],
        distanceKm: ranked.eta.distanceKm,
        etaMinutes: ranked.eta.estimatedTimeMinutes,
      };
    });
  }

  /**
   * Calculates aggregate estimated capacity across all allocated resources.
   */
  private calculateEstimatedCapacity(
    allAllocated: RankedResource[],
    hospitals: HospitalAssignment[],
    shelters: ShelterAssignment[]
  ): ResourceAllocationResult["estimatedCapacity"] {
    let totalResponders = 0;
    let totalVehicles = 0;
    let medicalUnits = 0;
    let rescueUnits = 0;

    for (const ranked of allAllocated) {
      const type = ranked.resource.type;

      if (type === "Police" || type === "Ambulance") {
        totalResponders += ranked.resource.metadata?.officerCount ?? ranked.resource.metadata?.paramedicCount ?? 2;
      }

      if (
        type === "Police" ||
        type === "Ambulance" ||
        type === "FireTruck" ||
        type === "RescueBoat"
      ) {
        totalVehicles++;
      }

      if (type === "Ambulance") {
        medicalUnits++;
      }

      if (type === "FireTruck" || type === "RescueBoat") {
        rescueUnits++;
      }
    }

    const hospitalBeds = hospitals.reduce(
      (sum, h) => sum + h.availableBeds,
      0
    );

    const shelterSpaces = shelters.reduce(
      (sum, s) => sum + s.remainingCapacity,
      0
    );

    return {
      totalResponders,
      totalVehicles,
      medicalUnits,
      rescueUnits,
      hospitalBeds,
      shelterSpaces,
    };
  }

  /**
   * Computes an overall resource score (0–100) summarizing
   * the quality of the entire allocation.
   */
  private calculateOverallResourceScore(
    selectedResources: RankedResource[],
    primaryTeam: TeamAssignment,
    backupTeam: TeamAssignment
  ): number {
    if (selectedResources.length === 0) return 0;

    const avgCompositeRank =
      selectedResources.reduce((sum, r) => sum + r.compositeRank, 0) /
      selectedResources.length;

    const primaryTeamFactor =
      primaryTeam.members.length > 0
        ? primaryTeam.totalCapabilityScore / 100
        : 0;

    const backupTeamFactor =
      backupTeam.members.length > 0 ? 0.15 : 0;

    const coverageFactor = Math.min(1, selectedResources.length / 5) * 10;

    const rawScore =
      avgCompositeRank * 0.6 +
      primaryTeamFactor * 25 +
      backupTeamFactor * 100 +
      coverageFactor;

    return parseFloat(Math.max(0, Math.min(100, rawScore)).toFixed(2));
  }

  /**
   * Generates a unique allocation ID.
   */
  private generateAllocationId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `ALLOC-SM-${timestamp}-${random}`;
  }

  /**
   * Finds the matching rule for an incident type (case-insensitive substring).
   */
  private findMatchingRule(incidentType: string) {
    const normalized = incidentType.toLowerCase();
    return INCIDENT_MATCHING_RULES.find((rule) =>
      normalized.includes(rule.incidentType.toLowerCase())
    );
  }
}
