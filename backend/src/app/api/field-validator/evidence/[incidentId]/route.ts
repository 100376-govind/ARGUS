import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { EvidenceCorrelationService } from "@/field-validator/services/evidence-correlation.service";
import { incidentRepo } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

export const GET = withHandler(async (req: NextRequest, context: { params: Promise<{ incidentId: string }> }) => {
  const { incidentId } = await context.params;

  const incident = await incidentRepo.findById(incidentId);
  if (!incident) {
    throw AppError.notFound("Incident", incidentId);
  }

  const service = new EvidenceCorrelationService(incidentRepo);
  const correlationResult = await service.correlate(incidentId);

  return NextResponse.json({
    success: true,
    data: correlationResult
  });
});
