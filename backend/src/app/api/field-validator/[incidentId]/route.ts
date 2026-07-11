import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { incidentRepo } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

const sharedMemory = new SharedIncidentMemory(incidentRepo);

/**
 * GET /api/field-validator/[incidentId] — Returns the full validation report
 * from the Evidence Fusion Engine for a given incident.
 */
export const GET = withHandler(async (req: NextRequest, context: { params: Promise<{ incidentId: string }> }) => {
  const { incidentId } = await context.params;

  const incident = await sharedMemory.read(incidentId);
  if (!incident) {
    throw AppError.notFound("Incident", incidentId);
  }

  // Extract evidence-fusion agent output from the agent history
  const fusionOutput = await sharedMemory.getLatestAgentOutput(incidentId, "evidence-fusion");
  // Extract field-validator agent output
  const fieldValidatorOutput = await sharedMemory.getLatestAgentOutput(incidentId, "field-validator");

  const validationReport = fusionOutput?.outputData?.validationReport || null;
  const networkIntelligence = fieldValidatorOutput?.outputData || null;

  return NextResponse.json({
    success: true,
    data: {
      incidentId,
      validationReport,
      networkIntelligence,
      validationScore: validationReport?.validationScore ?? null,
      validationStatus: validationReport?.validationStatus ?? "Pending",
      summary: validationReport?.summary ?? null,
      recommendation: validationReport?.recommendation ?? null,
      timestamp: validationReport?.timestamp ?? Date.now(),
    },
  });
});
