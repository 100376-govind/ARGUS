import { Location, ResourceType, Resource } from "../interfaces/resource-allocator.interface";

export interface FindResourcesQuery {
  location: Location;
  radiusKm: number;
  types?: ResourceType[];
}

export interface MatchResourcesRequest {
  incidentId: string;
  incidentType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  location: Location;
}

export interface MatchedResourceMatch {
  resource: Resource;
  score: number; // 0 to 100 based on proximity, capability, status
  eta: {
    estimatedTimeMinutes: number;
    distanceKm: number;
  };
}

export interface MatchResourcesResponse {
  incidentId: string;
  matches: MatchedResourceMatch[];
}

export interface ReserveResourcesRequest {
  resourceIds: string[];
}

export interface CreateAllocationRequest {
  incidentId: string;
  resourceIds: string[];
}
