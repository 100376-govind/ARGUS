import { ResourceType } from "../interfaces/resource-allocator.interface";
import {
  EnrichedResource,
  CapabilityScoreResult,
  ResponderSkillLevel,
  VehicleClassification,
  MedicalCapabilityLevel,
  RescueCapabilityLevel,
  ValidatedIncidentInput,
} from "../interfaces/resource-matching.interface";
import {
  INCIDENT_MATCHING_RULES,
  CAPABILITY_SCORING_WEIGHTS,
  PRIORITY_MULTIPLIER,
} from "../config/matching-rules.config";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";

/**
 * CapabilityScorer evaluates each enriched resource against an incident
 * and produces a composite capability score from 0–100.
 *
 * Scoring dimensions:
 *   - Incident Type Match (30 pts): How well the resource type aligns with the incident.
 *   - Priority Alignment (20 pts): Boost based on incident priority level.
 *   - Responder Skill (15 pts): Scored by relevance of skill to the incident.
 *   - Vehicle Type (10 pts): Fitness of the vehicle classification.
 *   - Medical Capability (15 pts): Medical readiness level.
 *   - Rescue Capability (10 pts): Rescue readiness level.
 */
export class CapabilityScorer {
  private readonly logger = new ResourceMatchingLogger("CapabilityScorer");

  /**
   * Scores a single resource against the given incident input.
   * Returns a CapabilityScoreResult with breakdown and total (0–100).
   */
  public scoreResource(
    resource: EnrichedResource,
    incident: ValidatedIncidentInput
  ): CapabilityScoreResult {
    const incidentTypeMatch = this.scoreIncidentTypeMatch(resource, incident);
    const priorityAlignment = this.scorePriorityAlignment(incident);
    const responderSkillScore = this.scoreResponderSkill(resource, incident);
    const vehicleTypeScore = this.scoreVehicleType(resource, incident);
    const medicalCapabilityScore = this.scoreMedicalCapability(resource, incident);
    const rescueCapabilityScore = this.scoreRescueCapability(resource, incident);

    const rawTotal =
      incidentTypeMatch +
      priorityAlignment +
      responderSkillScore +
      vehicleTypeScore +
      medicalCapabilityScore +
      rescueCapabilityScore;

    const totalScore = Math.max(0, Math.min(100, Math.round(rawTotal)));

    return {
      resourceId: resource.id,
      totalScore,
      breakdown: {
        incidentTypeMatch,
        priorityAlignment,
        responderSkillScore,
        vehicleTypeScore,
        medicalCapabilityScore,
        rescueCapabilityScore,
      },
    };
  }

  /**
   * Scores multiple resources against a single incident.
   * Returns an array of CapabilityScoreResult sorted by totalScore descending.
   */
  public scoreAll(
    resources: EnrichedResource[],
    incident: ValidatedIncidentInput
  ): CapabilityScoreResult[] {
    const results = resources.map((resource) =>
      this.scoreResource(resource, incident)
    );

    results.sort((a, b) => b.totalScore - a.totalScore);

    this.logger.debug("Capability scoring batch complete", {
      incidentId: incident.incidentId,
      resourcesScored: results.length,
      topScore: results.length > 0 ? results[0].totalScore : 0,
      bottomScore: results.length > 0 ? results[results.length - 1].totalScore : 0,
    });

    return results;
  }

  /**
   * Incident Type Match (max 30 pts).
   * Checks if the resource type is in the matching rule's required list
   * and assigns higher points for resources earlier in the priority order.
   */
  private scoreIncidentTypeMatch(
    resource: EnrichedResource,
    incident: ValidatedIncidentInput
  ): number {
    const maxPoints = CAPABILITY_SCORING_WEIGHTS.incidentTypeMatch;
    const rule = this.findMatchingRule(incident.incidentType);

    if (!rule) {
      return resource.type === "Ambulance" ? maxPoints * 0.5 : maxPoints * 0.2;
    }

    if (!rule.requiredResourceTypes.includes(resource.type)) {
      return maxPoints * 0.1;
    }

    const positionIndex = rule.priorityOrder.indexOf(resource.type);
    if (positionIndex === -1) {
      return maxPoints * 0.3;
    }

    const positionBonus = 1.0 - positionIndex * (0.15 / rule.priorityOrder.length);
    return Math.round(maxPoints * Math.max(0.3, positionBonus));
  }

  /**
   * Priority Alignment (max 20 pts).
   * Higher priority incidents receive more urgency weighting.
   */
  private scorePriorityAlignment(incident: ValidatedIncidentInput): number {
    const maxPoints = CAPABILITY_SCORING_WEIGHTS.priorityAlignment;
    const multiplier = PRIORITY_MULTIPLIER[incident.priority] ?? 0.45;
    return Math.round(maxPoints * multiplier);
  }

  /**
   * Responder Skill (max 15 pts).
   * Evaluates the relevance of the responder's skill level to the incident type.
   */
  private scoreResponderSkill(
    resource: EnrichedResource,
    incident: ValidatedIncidentInput
  ): number {
    const maxPoints = CAPABILITY_SCORING_WEIGHTS.responderSkill;
    const skill = resource.responderSkill ?? "BasicFirstAid";

    const skillRelevance = this.getSkillRelevance(skill, incident.incidentType);
    return Math.round(maxPoints * skillRelevance);
  }

  /**
   * Vehicle Type (max 10 pts).
   * Evaluates whether the vehicle classification is appropriate for the incident.
   */
  private scoreVehicleType(
    resource: EnrichedResource,
    incident: ValidatedIncidentInput
  ): number {
    const maxPoints = CAPABILITY_SCORING_WEIGHTS.vehicleType;
    const vehicle = resource.vehicleType ?? "UtilityVan";

    const vehicleRelevance = this.getVehicleRelevance(vehicle, incident.incidentType);
    return Math.round(maxPoints * vehicleRelevance);
  }

  /**
   * Medical Capability (max 15 pts).
   * Higher medical capability = higher score, weighted by estimated victim count.
   */
  private scoreMedicalCapability(
    resource: EnrichedResource,
    incident: ValidatedIncidentInput
  ): number {
    const maxPoints = CAPABILITY_SCORING_WEIGHTS.medicalCapability;
    const capability = resource.medicalCapability ?? "None";

    const baseLevelScore = this.getMedicalLevelScore(capability);

    const victimMultiplier =
      incident.estimatedVictims > 20
        ? 1.0
        : incident.estimatedVictims > 10
          ? 0.85
          : incident.estimatedVictims > 5
            ? 0.7
            : 0.5;

    return Math.round(maxPoints * baseLevelScore * victimMultiplier);
  }

  /**
   * Rescue Capability (max 10 pts).
   * Evaluates the rescue specialization against the incident requirements.
   */
  private scoreRescueCapability(
    resource: EnrichedResource,
    incident: ValidatedIncidentInput
  ): number {
    const maxPoints = CAPABILITY_SCORING_WEIGHTS.rescueCapability;
    const capability = resource.rescueCapability ?? "None";

    const rescueRelevance = this.getRescueRelevance(capability, incident.incidentType);
    return Math.round(maxPoints * rescueRelevance);
  }

  /**
   * Finds the matching rule for the given incident type.
   * Performs case-insensitive substring matching for flexibility.
   */
  private findMatchingRule(incidentType: string) {
    const normalized = incidentType.toLowerCase();
    return INCIDENT_MATCHING_RULES.find((rule) =>
      normalized.includes(rule.incidentType.toLowerCase())
    );
  }

  /**
   * Computes skill relevance (0.0–1.0) based on how well the responder's skill
   * matches the incident type.
   */
  private getSkillRelevance(skill: ResponderSkillLevel, incidentType: string): number {
    const normalized = incidentType.toLowerCase();

    const relevanceMap: Record<ResponderSkillLevel, Record<string, number>> = {
      BasicFirstAid: { fire: 0.3, flood: 0.3, earthquake: 0.3, medical: 0.5, hazmat: 0.2, collapse: 0.3, explosion: 0.3, evacuation: 0.4, search: 0.3, civil: 0.3 },
      AdvancedParamedic: { fire: 0.6, flood: 0.5, earthquake: 0.7, medical: 1.0, hazmat: 0.5, collapse: 0.7, explosion: 0.8, evacuation: 0.5, search: 0.6, civil: 0.4 },
      HazmatCertified: { fire: 0.8, flood: 0.3, earthquake: 0.5, medical: 0.3, hazmat: 1.0, collapse: 0.6, explosion: 0.9, evacuation: 0.3, search: 0.4, civil: 0.2 },
      SwiftWaterRescue: { fire: 0.1, flood: 1.0, earthquake: 0.3, medical: 0.1, hazmat: 0.1, collapse: 0.2, explosion: 0.1, evacuation: 0.7, search: 0.6, civil: 0.1 },
      StructuralFirefighter: { fire: 1.0, flood: 0.3, earthquake: 0.8, medical: 0.2, hazmat: 0.6, collapse: 0.9, explosion: 0.8, evacuation: 0.4, search: 0.7, civil: 0.2 },
      TacticalResponse: { fire: 0.3, flood: 0.2, earthquake: 0.4, medical: 0.2, hazmat: 0.3, collapse: 0.3, explosion: 0.5, evacuation: 0.6, search: 0.5, civil: 1.0 },
      SearchAndRescue: { fire: 0.5, flood: 0.7, earthquake: 1.0, medical: 0.3, hazmat: 0.3, collapse: 1.0, explosion: 0.6, evacuation: 0.5, search: 1.0, civil: 0.2 },
      CrisisNegotiator: { fire: 0.1, flood: 0.1, earthquake: 0.1, medical: 0.1, hazmat: 0.1, collapse: 0.1, explosion: 0.2, evacuation: 0.3, search: 0.2, civil: 0.9 },
    };

    const skillMap = relevanceMap[skill];
    for (const [keyword, score] of Object.entries(skillMap)) {
      if (normalized.includes(keyword)) {
        return score;
      }
    }

    return 0.2;
  }

  /**
   * Computes vehicle relevance (0.0–1.0) based on how well the vehicle type
   * suits the incident.
   */
  private getVehicleRelevance(vehicle: VehicleClassification, incidentType: string): number {
    const normalized = incidentType.toLowerCase();

    const relevanceMap: Record<VehicleClassification, Record<string, number>> = {
      PatrolCar: { fire: 0.3, flood: 0.2, earthquake: 0.3, medical: 0.2, hazmat: 0.2, collapse: 0.2, explosion: 0.3, evacuation: 0.5, search: 0.3, civil: 0.9 },
      ArmoredUnit: { fire: 0.2, flood: 0.1, earthquake: 0.2, medical: 0.1, hazmat: 0.3, collapse: 0.2, explosion: 0.4, evacuation: 0.3, search: 0.2, civil: 1.0 },
      BasicAmbulance: { fire: 0.5, flood: 0.4, earthquake: 0.6, medical: 0.8, hazmat: 0.4, collapse: 0.5, explosion: 0.6, evacuation: 0.4, search: 0.4, civil: 0.3 },
      AdvancedLifeSupport: { fire: 0.7, flood: 0.5, earthquake: 0.8, medical: 1.0, hazmat: 0.6, collapse: 0.7, explosion: 0.8, evacuation: 0.5, search: 0.5, civil: 0.3 },
      PumperTruck: { fire: 1.0, flood: 0.3, earthquake: 0.5, medical: 0.1, hazmat: 0.7, collapse: 0.5, explosion: 0.7, evacuation: 0.2, search: 0.4, civil: 0.1 },
      LadderTruck: { fire: 0.9, flood: 0.2, earthquake: 0.6, medical: 0.1, hazmat: 0.4, collapse: 0.7, explosion: 0.5, evacuation: 0.3, search: 0.5, civil: 0.1 },
      HeavyRescue: { fire: 0.7, flood: 0.4, earthquake: 0.9, medical: 0.2, hazmat: 0.8, collapse: 1.0, explosion: 0.8, evacuation: 0.4, search: 0.8, civil: 0.1 },
      InflatableRaft: { fire: 0.0, flood: 0.9, earthquake: 0.2, medical: 0.0, hazmat: 0.0, collapse: 0.1, explosion: 0.0, evacuation: 0.6, search: 0.5, civil: 0.0 },
      Motorboat: { fire: 0.0, flood: 1.0, earthquake: 0.2, medical: 0.0, hazmat: 0.0, collapse: 0.1, explosion: 0.0, evacuation: 0.7, search: 0.6, civil: 0.0 },
      UtilityVan: { fire: 0.2, flood: 0.2, earthquake: 0.3, medical: 0.4, hazmat: 0.2, collapse: 0.3, explosion: 0.2, evacuation: 0.4, search: 0.3, civil: 0.2 },
    };

    const vehicleMap = relevanceMap[vehicle];
    for (const [keyword, score] of Object.entries(vehicleMap)) {
      if (normalized.includes(keyword)) {
        return score;
      }
    }

    return 0.2;
  }

  /**
   * Returns a base score (0.0–1.0) for a medical capability level.
   */
  private getMedicalLevelScore(level: MedicalCapabilityLevel): number {
    const scores: Record<MedicalCapabilityLevel, number> = {
      None: 0.0,
      BasicFirstAid: 0.25,
      IntermediateCare: 0.5,
      AdvancedLifeSupport: 0.75,
      SurgicalCapable: 0.9,
      ICUMobile: 1.0,
    };
    return scores[level] ?? 0.0;
  }

  /**
   * Returns rescue relevance (0.0–1.0) for a rescue capability against an incident type.
   */
  private getRescueRelevance(capability: RescueCapabilityLevel, incidentType: string): number {
    const normalized = incidentType.toLowerCase();

    const relevanceMap: Record<RescueCapabilityLevel, Record<string, number>> = {
      None: { fire: 0.0, flood: 0.0, earthquake: 0.0, medical: 0.0, hazmat: 0.0, collapse: 0.0, explosion: 0.0, evacuation: 0.0, search: 0.0, civil: 0.0 },
      BasicExtraction: { fire: 0.4, flood: 0.3, earthquake: 0.5, medical: 0.2, hazmat: 0.3, collapse: 0.4, explosion: 0.4, evacuation: 0.3, search: 0.4, civil: 0.2 },
      WaterRescue: { fire: 0.1, flood: 1.0, earthquake: 0.2, medical: 0.0, hazmat: 0.0, collapse: 0.1, explosion: 0.0, evacuation: 0.7, search: 0.6, civil: 0.0 },
      HighAngle: { fire: 0.6, flood: 0.2, earthquake: 0.7, medical: 0.0, hazmat: 0.2, collapse: 0.8, explosion: 0.4, evacuation: 0.3, search: 0.7, civil: 0.0 },
      ConfinedSpace: { fire: 0.5, flood: 0.3, earthquake: 0.8, medical: 0.0, hazmat: 0.4, collapse: 0.9, explosion: 0.6, evacuation: 0.2, search: 0.8, civil: 0.0 },
      StructuralCollapse: { fire: 0.6, flood: 0.2, earthquake: 1.0, medical: 0.0, hazmat: 0.3, collapse: 1.0, explosion: 0.7, evacuation: 0.2, search: 0.9, civil: 0.0 },
      HeavyUrbanSAR: { fire: 0.5, flood: 0.4, earthquake: 1.0, medical: 0.1, hazmat: 0.5, collapse: 1.0, explosion: 0.8, evacuation: 0.3, search: 1.0, civil: 0.1 },
    };

    const capabilityMap = relevanceMap[capability];
    for (const [keyword, score] of Object.entries(capabilityMap)) {
      if (normalized.includes(keyword)) {
        return score;
      }
    }

    return 0.1;
  }
}
