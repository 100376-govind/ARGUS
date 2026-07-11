import { ValidationReport, FusionResult, ValidationStatus } from "../models/evidence-models";
import { GeminiSummaryResult } from "./validation-summary.service";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export class ValidationReportBuilder {
  private logger = new FieldValidatorLogger("ValidationReportBuilder");

  public buildReport(
    incidentId: string,
    fusionResult: FusionResult,
    geminiSummary: GeminiSummaryResult
  ): ValidationReport {
    const start = performance.now();
    this.logger.debug("Validation Report Generation Started");

    // Merge static observations with Gemini generated observations (capping total bullet counts to 5 maximum)
    const combinedSupports = [
      ...new Set([...fusionResult.supportingEvidence, ...geminiSummary.supportingObservations])
    ].slice(0, 5);

    const combinedConflicts = [
      ...new Set([...fusionResult.conflictingEvidence, ...geminiSummary.conflictingObservations])
    ].slice(0, 5);

    const report: ValidationReport = {
      incidentId,
      validationStatus: fusionResult.validationStatus,
      validationScore: fusionResult.overallValidationScore,
      evidenceBreakdown: fusionResult.evidenceBreakdown,
      supportingEvidence: combinedSupports,
      conflictingEvidence: combinedConflicts,
      summary: geminiSummary.summary,
      recommendation: geminiSummary.finalRecommendation,
      timestamp: Date.now()
    };

    const duration = performance.now() - start;
    this.logger.debug("Validation Report Generated", { incidentId });
    this.logger.performance("buildValidationReport", duration);

    return report;
  }
}
