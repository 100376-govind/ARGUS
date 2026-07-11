import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { NetworkCollectorService } from "@/field-validator/collectors/network-collector.service";
import { FeatureExtractionService } from "@/field-validator/ai/features/feature-extraction.service";
import { EnvironmentalAnalysisService } from "@/field-validator/ai/gemini/environmental-analysis.service";
import { FieldValidatorSharedMemoryIntegration } from "@/field-validator/services/shared-memory-integration";
import { SharedIncidentMemory } from "@/application/shared-memory/shared-incident-memory";
import { FieldValidatorExecutionService } from "@/field-validator/services/field-validator-execution.service";
import { incidentRepo } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

const collector = new NetworkCollectorService();
const featureExtractor = new FeatureExtractionService();
const analyzer = new EnvironmentalAnalysisService();
const sharedMemory = new SharedIncidentMemory(incidentRepo);
const sharedMemoryIntegration = new FieldValidatorSharedMemoryIntegration(sharedMemory);

const executionService = new FieldValidatorExecutionService(
  collector,
  featureExtractor,
  analyzer,
  sharedMemoryIntegration
);

export const POST = withHandler(async (req: NextRequest, context: { params: Promise<{ incidentId: string }> }) => {
  const { incidentId } = await context.params;

  const incident = await incidentRepo.findById(incidentId);
  if (!incident) {
    throw AppError.notFound("Incident", incidentId);
  }

  await executionService.executeFieldValidation(incidentId);

  // Read latest chain from shared memory to return the updated record
  const latestOutput = await sharedMemory.getLatestAgentOutput(incidentId, "field-validator");

  return NextResponse.json({
    success: true,
    data: latestOutput ? latestOutput.outputData : null
  });
});
