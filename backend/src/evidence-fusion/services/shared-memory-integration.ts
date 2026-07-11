import { SharedIncidentMemory } from "../../application/shared-memory/shared-incident-memory";
import { ValidationReport } from "../models/evidence-models";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export class EvidenceFusionSharedMemoryIntegration {
  private logger = new FieldValidatorLogger("EvidenceFusionSharedMemoryIntegration");

  constructor(private readonly sharedMemory: SharedIncidentMemory) {}

  public async appendValidationReport(report: ValidationReport): Promise<void> {
    const start = performance.now();
    const existing = await this.sharedMemory.read(report.incidentId);
    if (!existing) {
      throw new Error(`Incident ${report.incidentId} not found in Shared Memory`);
    }

    // Append validation results to memory without overwriting previous agent traces
    await this.sharedMemory.write(report.incidentId, "evidence-fusion", {
      status: report.validationScore >= 40 ? "success" : "failed",
      confidence: report.validationScore,
      reasoning: report.summary,
      outputData: {
        type: "evidence-fusion-report",
        validationReport: report,
        evidenceBreakdown: report.evidenceBreakdown,
        supportingEvidence: report.supportingEvidence,
        conflictingEvidence: report.conflictingEvidence,
        overallValidationScore: report.validationScore,
        validationRecommendation: report.recommendation,
        analysisTimestamp: Date.now()
      }
    });

    const duration = performance.now() - start;
    this.logger.debug("Shared Memory Updated", { incidentId: report.incidentId });
    this.logger.performance("sharedMemoryAppendReport", duration);
  }
}
