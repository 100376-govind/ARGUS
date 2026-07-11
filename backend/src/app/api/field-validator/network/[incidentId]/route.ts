import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { incidentRepo } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

const sharedMemory = new SharedIncidentMemory(incidentRepo);

/**
 * GET /api/field-validator/network/[incidentId] — Returns the Network Intelligence
 * snapshot and AI environmental analysis for a given incident.
 */
export const GET = withHandler(async (req: NextRequest, context: { params: Promise<{ incidentId: string }> }) => {
  const { incidentId } = await context.params;

  const incident = await sharedMemory.read(incidentId);
  if (!incident) {
    throw AppError.notFound("Incident", incidentId);
  }

  const fieldValidatorOutput = await sharedMemory.getLatestAgentOutput(incidentId, "field-validator");

  if (!fieldValidatorOutput) {
    return NextResponse.json({
      success: true,
      data: {
        incidentId,
        status: "pending",
        networkSnapshot: null,
        environmentalAnalysis: null,
        message: "Network intelligence has not yet been collected for this incident.",
      },
    });
  }

  const outputData = fieldValidatorOutput.outputData || {};

  return NextResponse.json({
    success: true,
    data: {
      incidentId,
      status: "completed",
      networkSnapshot: outputData.networkSnapshot || null,
      environmentalAnalysis: outputData.environmentalAnalysis || null,
      features: outputData.features || null,
      confidence: fieldValidatorOutput.confidence,
      timestamp: fieldValidatorOutput.timestamp,
    },
  });
});
