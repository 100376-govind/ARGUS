import { TeamAssignment, HospitalAssignment, ShelterAssignment, RankedResource } from "../interfaces/resource-matching.interface";
import { RouteDetails } from "../interfaces/route-optimization.interface";

export interface DispatchPlanItem {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  dispatchSequenceOrder: number;
  route: RouteDetails;
}

export interface DispatchPlanResult {
  dispatchPlanId: string;
  incidentId: string;
  dispatchOrder: DispatchPlanItem[];
  primaryTeam: TeamAssignment;
  backupTeam: TeamAssignment;
  hospitals: HospitalAssignment[];
  shelters: ShelterAssignment[];
  estimatedArrival: string; // ISO string representing when the first primary responder arrives
}
