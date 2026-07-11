import { ResourceType } from "../interfaces/resource-allocator.interface";
import {
  IncidentMatchingRule,
  ResponderSkillLevel,
  VehicleClassification,
  MedicalCapabilityLevel,
  RescueCapabilityLevel,
} from "../interfaces/resource-matching.interface";

/**
 * Configurable incident-to-resource matching rules.
 * Each rule defines what resource types are dispatched for a given incident type,
 * the priority order for selection, minimum counts, and scaling factors.
 */
export const INCIDENT_MATCHING_RULES: IncidentMatchingRule[] = [
  {
    incidentType: "Fire",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    priorityOrder: ["FireTruck", "Ambulance", "Police"],
    minimumResources: 3,
    scaleFactor: 1.5,
  },
  {
    incidentType: "Flood",
    requiredResourceTypes: ["RescueBoat", "Ambulance", "Police"],
    priorityOrder: ["RescueBoat", "Ambulance", "Police"],
    minimumResources: 3,
    scaleFactor: 2.0,
  },
  {
    incidentType: "Earthquake",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    priorityOrder: ["FireTruck", "Ambulance", "Police"],
    minimumResources: 4,
    scaleFactor: 2.5,
  },
  {
    incidentType: "Medical",
    requiredResourceTypes: ["Ambulance", "Hospital"],
    priorityOrder: ["Ambulance", "Hospital"],
    minimumResources: 2,
    scaleFactor: 1.0,
  },
  {
    incidentType: "Hazmat",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    priorityOrder: ["FireTruck", "Ambulance", "Police"],
    minimumResources: 3,
    scaleFactor: 1.8,
  },
  {
    incidentType: "Collapse",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    priorityOrder: ["FireTruck", "Ambulance", "Police"],
    minimumResources: 4,
    scaleFactor: 2.0,
  },
  {
    incidentType: "Explosion",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    priorityOrder: ["FireTruck", "Ambulance", "Police"],
    minimumResources: 5,
    scaleFactor: 2.5,
  },
  {
    incidentType: "Civil Unrest",
    requiredResourceTypes: ["Police", "Ambulance"],
    priorityOrder: ["Police", "Ambulance"],
    minimumResources: 4,
    scaleFactor: 1.5,
  },
  {
    incidentType: "Evacuation",
    requiredResourceTypes: ["Police", "Ambulance", "RescueBoat", "Shelter"],
    priorityOrder: ["Shelter", "Police", "Ambulance", "RescueBoat"],
    minimumResources: 3,
    scaleFactor: 2.0,
  },
  {
    incidentType: "Search and Rescue",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police", "RescueBoat"],
    priorityOrder: ["FireTruck", "RescueBoat", "Ambulance", "Police"],
    minimumResources: 4,
    scaleFactor: 2.0,
  },
];

/**
 * Mapping of resource IDs to enrichment metadata.
 * Used by the matching engine to evaluate capability scores.
 */
export const RESOURCE_ENRICHMENT_MAP: Record<
  string,
  {
    responderSkill: ResponderSkillLevel;
    vehicleType: VehicleClassification;
    medicalCapability: MedicalCapabilityLevel;
    rescueCapability: RescueCapabilityLevel;
  }
> = {
  "POLICE-DEV-1": {
    responderSkill: "TacticalResponse",
    vehicleType: "PatrolCar",
    medicalCapability: "BasicFirstAid",
    rescueCapability: "BasicExtraction",
  },
  "POLICE-DEV-2": {
    responderSkill: "CrisisNegotiator",
    vehicleType: "PatrolCar",
    medicalCapability: "BasicFirstAid",
    rescueCapability: "BasicExtraction",
  },
  "POLICE-DEV-3": {
    responderSkill: "TacticalResponse",
    vehicleType: "ArmoredUnit",
    medicalCapability: "None",
    rescueCapability: "BasicExtraction",
  },
  "POLICE-DEV-4": {
    responderSkill: "TacticalResponse",
    vehicleType: "PatrolCar",
    medicalCapability: "BasicFirstAid",
    rescueCapability: "None",
  },
  "POLICE-DEV-5": {
    responderSkill: "TacticalResponse",
    vehicleType: "PatrolCar",
    medicalCapability: "BasicFirstAid",
    rescueCapability: "BasicExtraction",
  },
  "AMB-DEV-1": {
    responderSkill: "AdvancedParamedic",
    vehicleType: "AdvancedLifeSupport",
    medicalCapability: "AdvancedLifeSupport",
    rescueCapability: "BasicExtraction",
  },
  "AMB-DEV-2": {
    responderSkill: "AdvancedParamedic",
    vehicleType: "BasicAmbulance",
    medicalCapability: "IntermediateCare",
    rescueCapability: "None",
  },
  "AMB-DEV-3": {
    responderSkill: "BasicFirstAid",
    vehicleType: "BasicAmbulance",
    medicalCapability: "BasicFirstAid",
    rescueCapability: "None",
  },
  "AMB-DEV-4": {
    responderSkill: "AdvancedParamedic",
    vehicleType: "AdvancedLifeSupport",
    medicalCapability: "AdvancedLifeSupport",
    rescueCapability: "BasicExtraction",
  },
  "FIRE-DEV-1": {
    responderSkill: "StructuralFirefighter",
    vehicleType: "PumperTruck",
    medicalCapability: "BasicFirstAid",
    rescueCapability: "StructuralCollapse",
  },
  "FIRE-DEV-2": {
    responderSkill: "StructuralFirefighter",
    vehicleType: "LadderTruck",
    medicalCapability: "BasicFirstAid",
    rescueCapability: "HighAngle",
  },
  "FIRE-DEV-3": {
    responderSkill: "HazmatCertified",
    vehicleType: "HeavyRescue",
    medicalCapability: "IntermediateCare",
    rescueCapability: "HeavyUrbanSAR",
  },
  "BOAT-DEV-1": {
    responderSkill: "SwiftWaterRescue",
    vehicleType: "Motorboat",
    medicalCapability: "BasicFirstAid",
    rescueCapability: "WaterRescue",
  },
  "BOAT-DEV-2": {
    responderSkill: "SwiftWaterRescue",
    vehicleType: "InflatableRaft",
    medicalCapability: "None",
    rescueCapability: "WaterRescue",
  },
  "HOSP-DEV-1": {
    responderSkill: "AdvancedParamedic",
    vehicleType: "UtilityVan",
    medicalCapability: "SurgicalCapable",
    rescueCapability: "None",
  },
  "HOSP-DEV-2": {
    responderSkill: "AdvancedParamedic",
    vehicleType: "UtilityVan",
    medicalCapability: "IntermediateCare",
    rescueCapability: "None",
  },
  "SHELTER-DEV-1": {
    responderSkill: "BasicFirstAid",
    vehicleType: "UtilityVan",
    medicalCapability: "BasicFirstAid",
    rescueCapability: "None",
  },
};

/**
 * Scoring weights for individual capability dimensions.
 * All weights must sum to 100.
 */
export const CAPABILITY_SCORING_WEIGHTS = {
  incidentTypeMatch: 30,
  priorityAlignment: 20,
  responderSkill: 15,
  vehicleType: 10,
  medicalCapability: 15,
  rescueCapability: 10,
} as const;

/**
 * Composite ranking weights for the final resource ranking.
 * All weights must sum to 1.0.
 */
export const RANKING_WEIGHTS = {
  capabilityScore: 0.45,
  availability: 0.20,
  distance: 0.15,
  priority: 0.20,
} as const;

/**
 * Priority multiplier map — higher priority incidents boost resource scoring.
 */
export const PRIORITY_MULTIPLIER: Record<string, number> = {
  CRITICAL: 1.0,
  HIGH: 0.85,
  MEDIUM: 0.65,
  LOW: 0.45,
};

/**
 * Default search radius (km) for resource discovery.
 */
export const DEFAULT_SEARCH_RADIUS_KM = 50;

/**
 * Maximum number of resources per team assignment.
 */
export const MAX_TEAM_SIZE = 6;

/**
 * Minimum acceptable capability score for a resource to be considered.
 */
export const MINIMUM_CAPABILITY_THRESHOLD = 15;
