import { Location, Resource, ResourceType, ETA } from "./resource-allocator.interface";

/**
 * Input received from the Field Validator pipeline stage.
 */
export interface ValidatedIncidentInput {
  incidentId: string;
  incidentType: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  validationStatus: "VALIDATED" | "UNVALIDATED" | "PARTIALLY_VALIDATED" | "REJECTED";
  validationConfidence: number;
  location: Location;
  coordinates: { latitude: number; longitude: number };
  estimatedVictims: number;
  requiredResources?: ResourceType[];
}

/**
 * Status values that disqualify a resource from selection.
 */
export type UnavailableStatus = "Busy" | "Offline" | "Maintenance";

/**
 * Extended resource with Phase 4.2 enrichment fields.
 */
export interface EnrichedResource extends Resource {
  responderSkill?: ResponderSkillLevel;
  vehicleType?: VehicleClassification;
  medicalCapability?: MedicalCapabilityLevel;
  rescueCapability?: RescueCapabilityLevel;
}

export type ResponderSkillLevel =
  | "BasicFirstAid"
  | "AdvancedParamedic"
  | "HazmatCertified"
  | "SwiftWaterRescue"
  | "StructuralFirefighter"
  | "TacticalResponse"
  | "SearchAndRescue"
  | "CrisisNegotiator";

export type VehicleClassification =
  | "PatrolCar"
  | "ArmoredUnit"
  | "BasicAmbulance"
  | "AdvancedLifeSupport"
  | "PumperTruck"
  | "LadderTruck"
  | "HeavyRescue"
  | "InflatableRaft"
  | "Motorboat"
  | "UtilityVan";

export type MedicalCapabilityLevel =
  | "None"
  | "BasicFirstAid"
  | "IntermediateCare"
  | "AdvancedLifeSupport"
  | "SurgicalCapable"
  | "ICUMobile";

export type RescueCapabilityLevel =
  | "None"
  | "BasicExtraction"
  | "WaterRescue"
  | "HighAngle"
  | "ConfinedSpace"
  | "StructuralCollapse"
  | "HeavyUrbanSAR";

/**
 * Capability score breakdown for a single resource evaluation.
 */
export interface CapabilityScoreResult {
  resourceId: string;
  totalScore: number;
  breakdown: {
    incidentTypeMatch: number;
    priorityAlignment: number;
    responderSkillScore: number;
    vehicleTypeScore: number;
    medicalCapabilityScore: number;
    rescueCapabilityScore: number;
  };
}

/**
 * A ranked resource entry combining scoring, distance, and availability.
 */
export interface RankedResource {
  resource: EnrichedResource;
  capabilityScore: number;
  availabilityWeight: number;
  distancePlaceholder: number;
  priorityWeight: number;
  compositeRank: number;
  eta: ETA;
}

/**
 * A team assignment within an allocation.
 */
export interface TeamAssignment {
  teamId: string;
  teamRole: "Primary" | "Backup";
  members: RankedResource[];
  totalCapabilityScore: number;
}

/**
 * Hospital assignment within an allocation.
 */
export interface HospitalAssignment {
  resourceId: string;
  name: string;
  availableBeds: number;
  icuAvailable: boolean;
  specialties: string[];
  distanceKm: number;
  etaMinutes: number;
}

/**
 * Shelter assignment within an allocation.
 */
export interface ShelterAssignment {
  resourceId: string;
  name: string;
  capacity: number;
  currentOccupancy: number;
  remainingCapacity: number;
  amenities: string[];
  distanceKm: number;
  etaMinutes: number;
}

/**
 * Final allocation output from the Smart Resource Matching Engine.
 */
export interface ResourceAllocationResult {
  allocationId: string;
  incidentId: string;
  incidentType: string;
  priority: string;
  allocatedResources: RankedResource[];
  primaryTeam: TeamAssignment;
  backupTeam: TeamAssignment;
  hospitals: HospitalAssignment[];
  shelters: ShelterAssignment[];
  estimatedCapacity: {
    totalResponders: number;
    totalVehicles: number;
    medicalUnits: number;
    rescueUnits: number;
    hospitalBeds: number;
    shelterSpaces: number;
  };
  resourceScore: number;
  allocationTimestamp: string;
}

/**
 * Data shape appended to Shared Incident Memory.
 */
export interface ResourceAllocationMemoryPayload {
  allocatedResources: RankedResource[];
  resourceScore: number;
  selectedTeams: {
    primary: TeamAssignment;
    backup: TeamAssignment;
  };
  allocationTimestamp: string;
}

/**
 * Configurable matching rule for an incident type.
 */
export interface IncidentMatchingRule {
  incidentType: string;
  requiredResourceTypes: ResourceType[];
  priorityOrder: ResourceType[];
  minimumResources: number;
  scaleFactor: number;
}
