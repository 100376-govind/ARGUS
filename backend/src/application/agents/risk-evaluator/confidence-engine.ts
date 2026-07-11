export interface ConfidenceEngineInput {
  dispatcherConfidence: number; // 0.0 - 1.0 or 0 - 100
  geminiConfidence: number; // 0.0 - 1.0 or 0 - 100
  incidentFields: {
    hasLocation: boolean;
    hasReporterDetails: boolean;
    hasVictimCountExplicit: boolean;
    hasEntitiesExtracted: boolean;
  };
  predictionConfidences: number[]; // Array of confidence scores for generated predictions
}

export class ConfidenceEngine {
  
  /**
   * Evaluates report completeness score (0.0 - 1.0) based on fields populated by data dispatcher.
   */
  public calculateDataCompleteness(fields: ConfidenceEngineInput["incidentFields"]): number {
    let score = 0;
    if (fields.hasLocation) score += 0.35;
    if (fields.hasReporterDetails) score += 0.20;
    if (fields.hasVictimCountExplicit) score += 0.25;
    if (fields.hasEntitiesExtracted) score += 0.20;
    return score;
  }

  /**
   * Integrates dispatcher confidence, Gemini AI model confidence, data completeness level, 
   * and prediction reliability into a final normalized confidence score (0.0 - 1.0).
   */
  public calculateFinalConfidence(input: ConfidenceEngineInput): number {
    // Standardize to 0.0 - 1.0 scale
    const norm = (val: number) => {
      if (val > 1.0) return val / 100;
      return Math.max(0.0, Math.min(1.0, val));
    };

    const dispConf = norm(input.dispatcherConfidence);
    const gemConf = norm(input.geminiConfidence);

    // Data completeness
    const completeness = this.calculateDataCompleteness(input.incidentFields);

    // Prediction reliability (average of predictions' confidence, fallback to 1.0 if empty)
    let predictionReliability = 1.0;
    if (input.predictionConfidences.length > 0) {
      const sum = input.predictionConfidences.reduce((a, b) => a + norm(b), 0);
      predictionReliability = sum / input.predictionConfidences.length;
    }

    // Weighted combination (30% Dispatcher, 30% Gemini, 20% Completeness, 20% Predictions)
    const finalScore =
      dispConf * 0.3 +
      gemConf * 0.3 +
      completeness * 0.2 +
      predictionReliability * 0.2;

    return parseFloat(Math.min(1.0, Math.max(0.0, finalScore)).toFixed(2));
  }
}

export const confidenceEngine = new ConfidenceEngine();
