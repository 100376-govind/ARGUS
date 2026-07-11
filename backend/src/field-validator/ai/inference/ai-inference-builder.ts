import { EnvironmentalInferenceResult } from "../../interfaces/ai-interfaces";
import { FieldValidatorLogger } from "../../utils/field-validator-logger";

export class AIInferenceBuilder {
  private static logger = new FieldValidatorLogger("AIInferenceBuilder");

  private static readonly PROHIBITED_TERMS = [
    "motion", "breathing", "heartbeat", "body", "survivor", "csi", "wall penetration", "human presence", "person detected", "victim detected", "human detected"
  ];

  public static buildValidatedInference(rawResult: EnvironmentalInferenceResult): EnvironmentalInferenceResult {
    const sanitizedInferences = rawResult.environmentalInference.map(inference => this.sanitizeStatement(inference));
    const sanitizedSummary = this.sanitizeStatement(rawResult.summary);

    this.logger.debug("Inference Generated and Sanitized");

    return {
      ...rawResult,
      environmentalInference: sanitizedInferences,
      summary: sanitizedSummary
    };
  }

  private static sanitizeStatement(statement: string): string {
    const lowerStatement = statement.toLowerCase();
    
    for (const term of this.PROHIBITED_TERMS) {
      if (lowerStatement.includes(term)) {
        this.logger.warn(`Prohibited term '${term}' detected in AI output. Sanitizing.`);
        return "Network activity suggests possible environmental changes.";
      }
    }
    return statement;
  }
}
