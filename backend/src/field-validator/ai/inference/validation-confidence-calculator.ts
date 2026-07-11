import { EnvironmentalInferenceResult } from "../../interfaces/ai-interfaces";
import { FieldValidatorLogger } from "../../utils/field-validator-logger";

export class ValidationConfidenceCalculator {
  private static logger = new FieldValidatorLogger("ValidationConfidenceCalculator");

  /**
   * Calculates the overall validation confidence based on Gemini's partial confidence scores.
   * 
   * Calculation Logic:
   * - Occupancy Confidence (Weight: 50%): High occupancy heavily supports the credibility of an emergency.
   * - Infrastructure Confidence (Weight: 30%): A degraded or completely offline infrastructure supports emergency states (e.g. disaster).
   * - Communication Confidence (Weight: 20%): Device communication stability.
   * 
   * The final score is bounded between 0 and 100.
   */
  public static calculateOverallConfidence(inference: EnvironmentalInferenceResult): number {
    const start = performance.now();
    
    // Ensure inputs are bounded 0-100
    const occ = this.bound(inference.occupancyConfidence);
    const inf = this.bound(inference.infrastructureConfidence);
    const comm = this.bound(inference.communicationConfidence);

    // AI already provided an overall `validationConfidence`, but we override or blend it to enforce strictly controlled heuristics
    const heuristicScore = (occ * 0.5) + (inf * 0.3) + (comm * 0.2);
    
    // Blend the AI's confidence with our strict heuristic (e.g., 60% heuristic, 40% AI)
    const aiScore = this.bound(inference.validationConfidence);
    const finalConfidence = Math.round((heuristicScore * 0.6) + (aiScore * 0.4));
    
    const duration = performance.now() - start;
    this.logger.debug("Validation Confidence Calculated", { finalConfidence, durationMs: duration });
    this.logger.performance("confidenceCalculation", duration);
    
    return finalConfidence;
  }

  private static bound(value: number): number {
    if (isNaN(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }
}
