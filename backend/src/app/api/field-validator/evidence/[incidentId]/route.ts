import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { incidentRepo } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

const sharedMemory = new SharedIncidentMemory(incidentRepo);

/**
 * GET /api/field-validator/evidence/[incidentId] — Returns the evidence breakdown
 * from the Evidence Fusion Engine showing all source contributions.
 */
export const GET = withHandler(async (req: NextRequest, context: { params: Promise<{ incidentId: string }> }) => {
  const { incidentId } = await context.params;

  const incident = await sharedMemory.read(incidentId);
  if (!incident) {
    throw AppError.notFound("Incident", incidentId);
  }

  const fusionOutput = await sharedMemory.getLatestAgentOutput(incidentId, "evidence-fusion");

  if (!fusionOutput) {
    return NextResponse.json({
      success: true,
      data: {
        incidentId,
        status: "pending",
        evidenceBreakdown: [],
        supportingEvidence: [],
        conflictingEvidence: [],
        message: "Evidence fusion has not yet been executed for this incident.",
      },
    });
  }

  const outputData = fusionOutput.outputData || {};

  return NextResponse.json({
    success: true,
    data: {
      incidentId,
      status: "completed",
      evidenceBreakdown: outputData.evidenceBreakdown || [],
      supportingEvidence: outputData.supportingEvidence || [],
      conflictingEvidence: outputData.conflictingEvidence || [],
      overallValidationScore: outputData.overallValidationScore ?? null,
      validationRecommendation: outputData.validationRecommendation ?? null,
      timestamp: fusionOutput.timestamp,
    },
  });
});
