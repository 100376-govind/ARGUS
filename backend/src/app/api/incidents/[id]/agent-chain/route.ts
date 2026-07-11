import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { incidentRepo } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

const sharedMemory = new SharedIncidentMemory(incidentRepo);

/**
 * GET /api/incidents/[id]/agent-chain — Returns the full agent execution history
 * for a given incident, ordered chronologically.
 */
export const GET = withHandler(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;

  const chain = await sharedMemory.getAgentChain(id);

  if (chain.length === 0) {
    // Check if incident exists
    const incident = await incidentRepo.findById(id);
    if (!incident) {
      throw AppError.notFound("Incident", id);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      incidentId: id,
      agentCount: chain.length,
      chain,
    },
  });
});
