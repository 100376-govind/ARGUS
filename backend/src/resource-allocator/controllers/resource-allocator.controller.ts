import { FindResourcesQuery, MatchResourcesRequest, MatchResourcesResponse, CreateAllocationRequest } from "../dto/resource-allocator.dto";
import { resourceAllocatorService, ResourceAllocatorService } from "../services/resource-allocator.service";
import { AllocationModel } from "../models/resource-allocator.model";
import { Resource } from "../interfaces/resource-allocator.interface";

export class ResourceAllocatorController {
  constructor(private readonly service: ResourceAllocatorService = resourceAllocatorService) {}

  /**
   * Action: Finds available resources within circular geographical proximity.
   */
  public findNearbyResources(query: FindResourcesQuery): Resource[] {
    return this.service.findResources(query.location, query.radiusKm, query.types);
  }

  /**
   * Action: Computes capabilities scoring and pairs optimal resources with an incident.
   */
  public matchIncidentResources(request: MatchResourcesRequest): MatchResourcesResponse {
    const nearby = this.service.findResources(request.location, 50); // Search within 50km radius
    const matches = this.service.matchResources(
      {
        id: request.incidentId,
        type: request.incidentType,
        severity: request.severity,
        location: request.location,
      },
      nearby
    );
    
    return {
      incidentId: request.incidentId,
      matches,
    };
  }

  /**
   * Action: Executes a coordinated allocation proposal sequence.
   * Finds, matches, reserves, and persists resource allocations.
   */
  public allocateResources(request: CreateAllocationRequest): AllocationModel {
    const allResources = this.service.getAllResources();
    const resourcesToAllocate: Resource[] = [];

    for (const resId of request.resourceIds) {
      const res = allResources.find((r) => r.id === resId);
      if (!res) {
        throw new Error(`Resource ${resId} not found`);
      }
      resourcesToAllocate.push(res);
    }

    // 1. Reserve matched resource status to lock concurrency
    this.service.reserveResources(request.resourceIds);

    // 2. Generate and store the allocation
    return this.service.generateAllocation(request.incidentId, resourcesToAllocate);
  }
}

export const resourceAllocatorController = new ResourceAllocatorController();
