import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { incidentRepo } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

const sharedMemory = new SharedIncidentMemory(incidentRepo);

/**
 * GET /api/field-validator/history/[incidentId] — Returns the timeline of validation activities
 * recorded in the agent history for the incident.
 */
export const GET = withHandler(async (req: NextRequest, context: { params: Promise<{ incidentId: string }> }) => {
  const { incidentId } = await context.params;

  const incident = await sharedMemory.read(incidentId);
  if (!incident) {
    throw AppError.notFound("Incident", incidentId);
  }

  const chain = await sharedMemory.getAgentChain(incidentId);

  // Map the agent chain execution history to a readable validation activity timeline
  const timeline = chain.map((record) => ({
    agentName: record.agentName,
    status: record.status,
    confidence: record.confidence,
    reasoning: record.reasoning,
    timestamp: record.timestamp,
  }));

  return NextResponse.json({
    success: true,
    data: {
      incidentId,
      timeline,
    },
  });
});
