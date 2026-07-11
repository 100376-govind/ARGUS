import { ResourceType } from "../interfaces/resource-allocator.interface";

/**
 * Configurable mapping of incident types to their required resource types.
 * Each entry defines exactly which resources an incident demands.
 *
 * This is the SINGLE SOURCE OF TRUTH for incident → resource determination.
 * To add or modify mappings, edit only this file.
 */
export interface IncidentResourceRequirement {
  /** The incident type key (case-insensitive matching via normalization). */
  incidentType: string;
  /** Ordered list of resource types required for this incident. */
  requiredResourceTypes: ResourceType[];
  /** Priority order for allocation (first = most critical). */
  allocationPriority: ResourceType[];
  /** Human-readable label for each resource. */
  resourceLabels: Record<string, string>;
}

/**
 * Master incident-to-resource mapping configuration.
 * Supports: Fire, Flood, Building Collapse, Earthquake, Medical,
 * Chemical Leak, Road Accident, and extensible for future types.
 */
export const INCIDENT_RESOURCE_MAP: IncidentResourceRequirement[] = [
  {
    incidentType: "fire",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    allocationPriority: ["FireTruck", "Ambulance", "Police"],
    resourceLabels: {
      FireTruck: "Fire Truck",
      Ambulance: "Ambulance",
      Police: "Police Unit",
    },
  },
  {
    incidentType: "flood",
    requiredResourceTypes: ["RescueBoat", "Ambulance", "Police"],
    allocationPriority: ["RescueBoat", "Ambulance", "Police"],
    resourceLabels: {
      RescueBoat: "Rescue Boat",
      Ambulance: "Ambulance",
      Police: "Police Unit",
    },
  },
  {
    incidentType: "building collapse",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    allocationPriority: ["FireTruck", "Ambulance", "Police"],
    resourceLabels: {
      FireTruck: "Rescue Team / Fire Truck",
      Ambulance: "Ambulance",
      Police: "Police Unit",
    },
  },
  {
    incidentType: "collapse",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    allocationPriority: ["FireTruck", "Ambulance", "Police"],
    resourceLabels: {
      FireTruck: "Rescue Team / Fire Truck",
      Ambulance: "Ambulance",
      Police: "Police Unit",
    },
  },
  {
    incidentType: "earthquake",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    allocationPriority: ["FireTruck", "Ambulance", "Police"],
    resourceLabels: {
      FireTruck: "Search & Rescue Team",
      Ambulance: "Ambulance",
      Police: "Police Unit",
    },
  },
  {
    incidentType: "medical",
    requiredResourceTypes: ["Ambulance", "Hospital"],
    allocationPriority: ["Ambulance", "Hospital"],
    resourceLabels: {
      Ambulance: "Ambulance",
      Hospital: "Hospital",
    },
  },
  {
    incidentType: "chemical leak",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    allocationPriority: ["FireTruck", "Police", "Ambulance"],
    resourceLabels: {
      FireTruck: "Hazmat Team / Fire Truck",
      Ambulance: "Ambulance",
      Police: "Police Unit",
    },
  },
  {
    incidentType: "hazmat",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    allocationPriority: ["FireTruck", "Police", "Ambulance"],
    resourceLabels: {
      FireTruck: "Hazmat Team / Fire Truck",
      Ambulance: "Ambulance",
      Police: "Police Unit",
    },
  },
  {
    incidentType: "road accident",
    requiredResourceTypes: ["Ambulance", "Police"],
    allocationPriority: ["Ambulance", "Police"],
    resourceLabels: {
      Ambulance: "Ambulance",
      Police: "Police / Tow Vehicle",
    },
  },
  {
    incidentType: "accident",
    requiredResourceTypes: ["Ambulance", "Police"],
    allocationPriority: ["Ambulance", "Police"],
    resourceLabels: {
      Ambulance: "Ambulance",
      Police: "Police / Tow Vehicle",
    },
  },
  {
    incidentType: "explosion",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police"],
    allocationPriority: ["FireTruck", "Ambulance", "Police"],
    resourceLabels: {
      FireTruck: "Fire Truck",
      Ambulance: "Ambulance",
      Police: "Police Unit",
    },
  },
  {
    incidentType: "civil unrest",
    requiredResourceTypes: ["Police", "Ambulance"],
    allocationPriority: ["Police", "Ambulance"],
    resourceLabels: {
      Police: "Police Unit",
      Ambulance: "Ambulance",
    },
  },
  {
    incidentType: "evacuation",
    requiredResourceTypes: ["Police", "Ambulance", "RescueBoat", "Shelter"],
    allocationPriority: ["Shelter", "Police", "Ambulance", "RescueBoat"],
    resourceLabels: {
      Police: "Police Unit",
      Ambulance: "Ambulance",
      RescueBoat: "Rescue Boat",
      Shelter: "Evacuation Shelter",
    },
  },
  {
    incidentType: "search and rescue",
    requiredResourceTypes: ["FireTruck", "Ambulance", "Police", "RescueBoat"],
    allocationPriority: ["FireTruck", "RescueBoat", "Ambulance", "Police"],
    resourceLabels: {
      FireTruck: "Search & Rescue Team",
      RescueBoat: "Rescue Boat",
      Ambulance: "Ambulance",
      Police: "Police Unit",
    },
  },
];

/**
 * Victim-count-based quantity scaling thresholds.
 * Each tier defines the multiplier for each resource type based on estimated victims.
 */
export interface VictimQuantityTier {
  /** Maximum victim count for this tier (inclusive). Use Infinity for the last tier. */
  maxVictims: number;
  /** Label for this tier. */
  label: string;
  /** Base quantity multiplier for each resource type at this tier. */
  baseQuantity: Record<string, number>;
}

export const VICTIM_QUANTITY_TIERS: VictimQuantityTier[] = [
  {
    maxVictims: 2,
    label: "Minor",
    baseQuantity: {
      Ambulance: 1,
      FireTruck: 1,
      Police: 1,
      RescueBoat: 1,
      Hospital: 1,
      Shelter: 1,
    },
  },
  {
    maxVictims: 10,
    label: "Moderate",
    baseQuantity: {
      Ambulance: 2,
      FireTruck: 2,
      Police: 2,
      RescueBoat: 1,
      Hospital: 1,
      Shelter: 1,
    },
  },
  {
    maxVictims: Infinity,
    label: "Major",
    baseQuantity: {
      Ambulance: 4,
      FireTruck: 3,
      Police: 3,
      RescueBoat: 2,
      Hospital: 2,
      Shelter: 2,
    },
  },
];

/**
 * Priority boost: High/Critical priority incidents get +1 to each resource count.
 */
export const HIGH_PRIORITY_RESOURCE_BOOST = 1;

/**
 * Resolves a matching IncidentResourceRequirement for a given incident type string.
 * Performs case-insensitive substring matching.
 */
export function resolveIncidentResourceMapping(
  incidentType: string
): IncidentResourceRequirement | undefined {
  const normalized = incidentType.toLowerCase().trim();
  return INCIDENT_RESOURCE_MAP.find((mapping) =>
    normalized.includes(mapping.incidentType)
  );
}
