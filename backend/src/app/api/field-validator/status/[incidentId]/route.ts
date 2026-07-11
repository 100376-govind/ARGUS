import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { incidentRepo } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

const sharedMemory = new SharedIncidentMemory(incidentRepo);

/**
 * GET /api/field-validator/status/[incidentId] — Returns the current validation status.
 */
export const GET = withHandler(async (req: NextRequest, context: { params: Promise<{ incidentId: string }> }) => {
  const { incidentId } = await context.params;

  const incident = await sharedMemory.read(incidentId);
  if (!incident) {
    throw AppError.notFound("Incident", incidentId);
  }

  const fusionOutput = await sharedMemory.getLatestAgentOutput(incidentId, "evidence-fusion");
  const fieldValidatorOutput = await sharedMemory.getLatestAgentOutput(incidentId, "field-validator");

  let status: "Verified" | "Likely Valid" | "Needs Manual Verification" | "Unverified" | "Pending" = "Pending";
  let score = 0;

  if (fusionOutput?.outputData?.validationReport) {
    status = fusionOutput.outputData.validationReport.validationStatus;
    score = fusionOutput.outputData.validationReport.validationScore;
  } else if (fieldValidatorOutput) {
    status = "Needs Manual Verification"; // fallback if field validator run is completed but not fusion
    score = Math.round(fieldValidatorOutput.confidence * 100);
  }

  return NextResponse.json({
    success: true,
    data: {
      incidentId,
      status,
      score,
      lastUpdated: fusionOutput?.timestamp || fieldValidatorOutput?.timestamp || Date.now(),
    },
  });
});
