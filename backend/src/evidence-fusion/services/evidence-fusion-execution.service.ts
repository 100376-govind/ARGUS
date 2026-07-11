import { EvidenceResult, FusionResult, ValidationReport } from "../models/evidence-models";
import { EvidenceNormalizationService } from "./normalization.service";
import { EvidenceFusionService } from "./fusion.service";
import { ValidationSummaryService } from "./validation-summary.service";
import { ValidationReportBuilder } from "./report-builder";
import { EvidenceFusionSharedMemoryIntegration } from "./shared-memory-integration";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export class EvidenceFusionExecutionService {
  private logger = new FieldValidatorLogger("EvidenceFusionExecutionService");

  constructor(
    private readonly normalizer: EvidenceNormalizationService,
    private readonly fusionService: EvidenceFusionService,
    private readonly summaryService: ValidationSummaryService,
    private readonly reportBuilder: ValidationReportBuilder,
    private readonly sharedMemoryIntegration: EvidenceFusionSharedMemoryIntegration
  ) {}

  public async executeEvidenceFusion(
    incidentId: string,
    rawEvidences: { source: any; rawData: any }[]
  ): Promise<ValidationReport> {
    const start = performance.now();
    this.logger.info(`Evidence Collection Started for Incident: ${incidentId}`);

    try {
      // 1. Evidence Normalization
      const normalizedEvidences: EvidenceResult[] = rawEvidences.map(raw =>
        this.normalizer.normalize(raw.source, raw.rawData)
      );
      this.logger.debug("Evidence Normalization Completed");

      // 2. Evidence Fusion & Weight Calculation
      const fusionResult = await this.fusionService.fuse(normalizedEvidences);
      this.logger.debug("Weight Calculation Completed");
      this.logger.debug("Conflict Detection Completed");

      // 3. Gemini Validation Summary (considers supporting/conflicting observations)
      const geminiSummary = await this.summaryService.generateSummary(
        normalizedEvidences,
        fusionResult.conflictingEvidence,
        fusionResult.supportingEvidence
      );
      this.logger.debug("Fusion Completed");

      // 4. Validation Report Generation
      const finalReport = this.reportBuilder.buildReport(incidentId, fusionResult, geminiSummary);
      this.logger.debug("Validation Report Generated");

      // 5. Shared Memory Append
      await this.sharedMemoryIntegration.appendValidationReport(finalReport);
      this.logger.debug("Shared Memory Updated");

      const duration = performance.now() - start;
      this.logger.performance("executeEvidenceFusionTotal", duration);
      this.logger.info(`Evidence Fusion completed successfully in ${duration.toFixed(2)}ms`);

      return finalReport;
    } catch (error) {
      this.logger.error(`Evidence Fusion execution failed for incident ${incidentId}`, error as Error);
      throw error;
    }
  }
}
