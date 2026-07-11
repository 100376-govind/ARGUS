import { NextRequest, NextResponse } from "next/server";
import { GetAllocationParamsSchema } from "@/resource-allocator/dto/resource-allocator-api.dto";
import { RequestValidator } from "@/presentation/middleware/validation.middleware";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { incidentRepo } from "@/shared/container";
import { StandardResponse } from "@/presentation/responses/standard-response";
import { AuthenticationHooks } from "@/presentation/middleware/auth.hooks";

const sharedMemory = new SharedIncidentMemory(incidentRepo);

export class ResourceAllocatorApiController {
  /**
   * GET /api/resource-allocator/:incidentId
   */
  public async getAllocationDetails(req: NextRequest, context: any): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    AuthenticationHooks.authorize(user, ["Commander", "Admin", "Dispatcher"]);

    const params = RequestValidator.validateParams(context, GetAllocationParamsSchema);
    const incidentId = params.incidentId;

    const incident = await sharedMemory.read(incidentId);
    if (!incident) {
      return StandardResponse.error([`Incident ${incidentId} not found`], "Incident not found", 404);
    }

    const allocationRecord = await sharedMemory.getLatestAgentOutput(incidentId, "resource-matching-engine");
    const routeRecord = await sharedMemory.getLatestAgentOutput(incidentId, "route-optimization-engine");

    const payload = {
      incidentId,
      allocation: allocationRecord?.outputData || null,
      dispatchPlan: routeRecord?.outputData?.dispatchPlan || null,
      resources: allocationRecord?.outputData?.allocatedResources || [],
      eta: routeRecord?.outputData?.eta ?? null,
      distance: routeRecord?.outputData?.distance ?? null,
      routeStatus: routeRecord?.outputData?.routeStatus ?? "Pending",
      status: allocationRecord ? "allocated" : "pending",
      estimatedArrival: routeRecord?.outputData?.estimatedArrival || null,
    };

    return StandardResponse.success(payload, "Resource allocation details retrieved successfully");
  }

  /**
   * GET /api/resource-allocator/history/:incidentId
   */
  public async getAllocationHistory(req: NextRequest, context: any): Promise<NextResponse> {
    const user = await AuthenticationHooks.authenticate(req);
    AuthenticationHooks.authorize(user, ["Commander", "Admin", "Dispatcher"]);

    const params = RequestValidator.validateParams(context, GetAllocationParamsSchema);
    const incidentId = params.incidentId;

    const history = await sharedMemory.getAgentChain(incidentId);
    const allocationHistory = history.filter(
      (h) => h.agentName === "resource-matching-engine" || h.agentName === "route-optimization-engine"
    );

    return StandardResponse.success(allocationHistory, "Resource allocation history retrieved successfully");
  }
}

export const resourceAllocatorApiController = new ResourceAllocatorApiController();
