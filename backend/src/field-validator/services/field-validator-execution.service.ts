import { NetworkCollectorService } from "../collectors/network-collector.service";
import { FeatureExtractionService } from "../ai/features/feature-extraction.service";
import { OccupancyEstimator } from "../ai/estimators/occupancy-estimator";
import { InfrastructureAssessmentService } from "../ai/estimators/infrastructure-assessment.service";
import { EnvironmentalAnalysisService } from "../ai/gemini/environmental-analysis.service";
import { AIInferenceBuilder } from "../ai/inference/ai-inference-builder";
import { ValidationConfidenceCalculator } from "../ai/inference/validation-confidence-calculator";
import { FieldValidatorSharedMemoryIntegration } from "./shared-memory-integration";
import { FieldValidatorLogger } from "../utils/field-validator-logger";
import { ValidationEvidenceModel } from "../models/network-models";

export class FieldValidatorExecutionService {
  private logger = new FieldValidatorLogger("FieldValidatorExecutionService");

  constructor(
    private collector: NetworkCollectorService,
    private featureExtractor: FeatureExtractionService,
    private analyzer: EnvironmentalAnalysisService,
    private sharedMemoryIntegration: FieldValidatorSharedMemoryIntegration
  ) {}

  public async executeFieldValidation(incidentId: string): Promise<void> {
    const startTime = performance.now();
    this.logger.info(`Execution Started for Incident ${incidentId}`);

    try {
      // 1. Collect Network Data
      const snapshot = await this.collector.collectSnapshot();

      // 2. Extract AI Features
      const features = this.featureExtractor.extractFeatures(snapshot);

      // 3. Preliminary Estimations
      const occupancyEstimate = OccupancyEstimator.estimate(features);
      const infraAssessment = InfrastructureAssessmentService.assess(features);

      // 4. Gemini Environmental Analysis
      const rawInference = await this.analyzer.analyze(features, occupancyEstimate, infraAssessment);

      // 5. Build Cautious Inference
      const safeInference = AIInferenceBuilder.buildValidatedInference(rawInference);

      // 6. Calculate Final Confidence
      const finalConfidence = ValidationConfidenceCalculator.calculateOverallConfidence(safeInference);
      safeInference.validationConfidence = finalConfidence;

      // 7. Shared Memory Integration (Append Only)
      await this.sharedMemoryIntegration.appendEnvironmentalInference(incidentId, safeInference, features);

      const duration = performance.now() - startTime;
      this.logger.performance("executeFieldValidation", duration);
      this.logger.info(`Execution Completed successfully in ${duration.toFixed(2)}ms`);

    } catch (error) {
      this.logger.error("Field Validation Execution Failed", error as Error);
      // Graceful degradation logic or re-throwing depending on orchestrator
      throw error;
    }
  }
}
