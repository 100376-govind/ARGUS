import { EvidenceCorrelationService } from "./evidence-correlation.service";
import { FieldValidatorSharedMemoryIntegration } from "./shared-memory-integration";
import { FieldValidatorConfig } from "../constants/field-validator-config";
import { IIncidentRepository } from "@/domain/repositories/incident-repository";
import { FieldValidatorLogger } from "../utils/field-validator-logger";

export class ValidationPriorityService {
  private logger = new FieldValidatorLogger("ValidationPriorityService");

  constructor(
    private readonly correlationService: EvidenceCorrelationService,
    private readonly sharedMemoryIntegration: FieldValidatorSharedMemoryIntegration,
    private readonly incidentRepo: IIncidentRepository
  ) {}

  public async validate(
    incidentId: string,
    executeWiFiValidation: () => Promise<any>
  ): Promise<{
    evidenceCorrelation: any;
    supportingReports: any[];
    keywordSimilarity: number;
    locationSimilarity: number;
    incidentSimilarity: number;
    timeSimilarity: number;
    validationConfidence: number;
    validationSource: string;
    wifiValidation?: any;
    finalValidationConfidence: number;
  }> {
    this.logger.info(`Starting priority validation for incident ${incidentId}`);

    // 1. Run Evidence Correlation
    const correlationResult = await this.correlationService.correlate(incidentId);
    const threshold = FieldValidatorConfig.validationThreshold;

    this.logger.info(
      `Evidence correlation confidence: ${correlationResult.validationConfidence}% (Threshold: ${threshold}%)`
    );

    let validationSource = "";
    let wifiValidationResult: any = null;
    let finalConfidence = correlationResult.validationConfidence;

    if (correlationResult.validationConfidence >= threshold) {
      // Confidence is high enough, skip WiFi validation
      validationSource = "evidence-correlation";
      this.logger.info("Confidence above threshold. Skipping WiFi validation.");

      // Mark incident as verified
      await this.incidentRepo.update(incidentId, { status: "verified" }, "agent:field-validator", "mark_verified");

      // Write results to Shared Memory
      await this.sharedMemoryIntegration.appendEvidenceCorrelation(incidentId, {
        evidenceCorrelation: correlationResult.evidenceCorrelation,
        supportingReports: correlationResult.supportingReports,
        similarityScores: {
          keywordSimilarity: correlationResult.keywordSimilarity,
          locationSimilarity: correlationResult.locationSimilarity,
          incidentSimilarity: correlationResult.incidentSimilarity,
          timeSimilarity: correlationResult.timeSimilarity,
        },
        correlationConfidence: correlationResult.validationConfidence,
        validationSource,
      });
    } else {
      // Execute existing WiFi validation
      validationSource = "wifi-environment-intelligence";
      this.logger.info("Confidence below threshold. Executing WiFi validation.");

      // Run the callback to execute WiFi validation
      const wifiResult = await executeWiFiValidation();
      wifiValidationResult = wifiResult;

      // Merge both validation results: standard probabilistic union
      const pCorrelation = correlationResult.validationConfidence / 100;
      const pWiFi = (wifiResult.validationConfidence || 0) / 100;
      const combinedP = pCorrelation + pWiFi - pCorrelation * pWiFi;
      finalConfidence = Math.min(100, Math.round(combinedP * 100));

      this.logger.info(
        `Merged validation confidence: ${finalConfidence}% (Evidence: ${correlationResult.validationConfidence}%, WiFi: ${wifiResult.validationConfidence}%)`
      );

      // Write results to Shared Memory, merging both sections
      await this.sharedMemoryIntegration.appendEvidenceCorrelation(incidentId, {
        evidenceCorrelation: correlationResult.evidenceCorrelation,
        supportingReports: correlationResult.supportingReports,
        similarityScores: {
          keywordSimilarity: correlationResult.keywordSimilarity,
          locationSimilarity: correlationResult.locationSimilarity,
          incidentSimilarity: correlationResult.incidentSimilarity,
          timeSimilarity: correlationResult.timeSimilarity,
        },
        correlationConfidence: finalConfidence,
        validationSource: "merged",
        wifiValidation: wifiResult,
      });
    }

    return {
      ...correlationResult,
      validationSource,
      wifiValidation: wifiValidationResult,
      finalValidationConfidence: finalConfidence,
    };
  }
}
