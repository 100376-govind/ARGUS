import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import {
  ResourceAllocationResult,
  ResourceAllocationMemoryPayload,
} from "../interfaces/resource-matching.interface";
import { ResourceMatchingLogger } from "../utils/resource-matching-logger";

/**
 * ResourceAllocatorSharedMemoryIntegration appends resource allocation
 * data to the Shared Incident Memory without overwriting previous data.
 *
 * Writes allocation results as agent execution records under the
 * "resource-matching-engine" agent identity.
 */
export class ResourceAllocatorSharedMemoryIntegration {
  private readonly logger = new ResourceMatchingLogger("SharedMemoryIntegration");

  constructor(private readonly sharedMemory: SharedIncidentMemory) {}

  /**
   * Appends resource allocation data to the shared incident memory.
   * Does NOT overwrite any previous data — appends a new AgentExecutionRecord.
   */
  public async appendAllocationResult(
    incidentId: string,
    allocation: ResourceAllocationResult
  ): Promise<void> {
    const existing = await this.sharedMemory.read(incidentId);
    if (!existing) {
      throw new Error(
        `SharedMemory: Incident ${incidentId} not found — cannot append allocation`
      );
    }

    const memoryPayload: ResourceAllocationMemoryPayload = {
      allocatedResources: allocation.allocatedResources,
      resourceScore: allocation.resourceScore,
      selectedTeams: {
        primary: allocation.primaryTeam,
        backup: allocation.backupTeam,
      },
      allocationTimestamp: allocation.allocationTimestamp,
    };

    await this.sharedMemory.write(incidentId, "resource-matching-engine", {
      status: "success",
      confidence: Math.min(100, Math.round(allocation.resourceScore)),
      reasoning: this.buildReasoning(allocation),
      outputData: {
        type: "resource-allocation",
        allocationId: allocation.allocationId,
        incidentType: allocation.incidentType,
        priority: allocation.priority,
        allocatedResources: memoryPayload.allocatedResources.map((r) => ({
          resourceId: r.resource.id,
          resourceName: r.resource.name,
          resourceType: r.resource.type,
          capabilityScore: r.capabilityScore,
          compositeRank: r.compositeRank,
          etaMinutes: r.eta.estimatedTimeMinutes,
          distanceKm: r.eta.distanceKm,
        })),
        resourceScore: memoryPayload.resourceScore,
        selectedTeams: {
          primary: {
            teamId: memoryPayload.selectedTeams.primary.teamId,
            memberCount: memoryPayload.selectedTeams.primary.members.length,
            avgCapabilityScore: memoryPayload.selectedTeams.primary.totalCapabilityScore,
          },
          backup: {
            teamId: memoryPayload.selectedTeams.backup.teamId,
            memberCount: memoryPayload.selectedTeams.backup.members.length,
            avgCapabilityScore: memoryPayload.selectedTeams.backup.totalCapabilityScore,
          },
        },
        hospitals: allocation.hospitals.map((h) => ({
          resourceId: h.resourceId,
          name: h.name,
          availableBeds: h.availableBeds,
          icuAvailable: h.icuAvailable,
        })),
        shelters: allocation.shelters.map((s) => ({
          resourceId: s.resourceId,
          name: s.name,
          remainingCapacity: s.remainingCapacity,
        })),
        estimatedCapacity: allocation.estimatedCapacity,
        allocationTimestamp: memoryPayload.allocationTimestamp,
      },
    });

    this.logger.logSharedMemoryUpdated(incidentId, allocation.allocationId);
  }

  /**
   * Builds a human-readable reasoning string describing the allocation.
   */
  private buildReasoning(allocation: ResourceAllocationResult): string {
    const parts: string[] = [
      `Resource allocation completed for ${allocation.incidentType} incident (priority: ${allocation.priority}).`,
      `Primary team: ${allocation.primaryTeam.members.length} resources assigned (avg capability: ${allocation.primaryTeam.totalCapabilityScore}).`,
      `Backup team: ${allocation.backupTeam.members.length} resources on standby.`,
    ];

    if (allocation.hospitals.length > 0) {
      const totalBeds = allocation.hospitals.reduce((s, h) => s + h.availableBeds, 0);
      parts.push(
        `${allocation.hospitals.length} hospital(s) identified with ${totalBeds} available beds.`
      );
    }

    if (allocation.shelters.length > 0) {
      const totalCapacity = allocation.shelters.reduce((s, sh) => s + sh.remainingCapacity, 0);
      parts.push(
        `${allocation.shelters.length} shelter(s) identified with ${totalCapacity} remaining spaces.`
      );
    }

    parts.push(`Overall resource score: ${allocation.resourceScore}/100.`);

    return parts.join(" ");
  }
}
