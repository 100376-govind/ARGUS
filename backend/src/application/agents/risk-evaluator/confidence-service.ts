import { confidenceEngine, ConfidenceEngineInput } from "./confidence-engine";

export interface ConfidenceAssessment {
  overallConfidence: number; // 0 - 100
  breakdown: {
    dispatcherConfidence: number;
    geminiConfidence: number;
    dataCompleteness: number;
    predictionConfidence: number;
  };
  explanation: string;
}

export class ConfidenceService {
  /**
   * Evaluates details and weights to compile a final confidence assessment, 
   * outputting scores and written summaries detailing calculation limits.
   */
  public evaluateConfidence(input: ConfidenceEngineInput): ConfidenceAssessment {
    // 1. Calculate final confidence (returns value 0.0 - 1.0)
    const finalConf = confidenceEngine.calculateFinalConfidence(input);
    const overallConfidence = Math.round(finalConf * 100);

    // 2. Data completeness calculation
    const completenessVal = Math.round(confidenceEngine.calculateDataCompleteness(input.incidentFields) * 100);

    // 3. Average prediction confidence
    let averagePredictionConfidence = 100;
    if (input.predictionConfidences.length > 0) {
      const sum = input.predictionConfidences.reduce((a, b) => {
        const val = b <= 1.0 ? b * 100 : b;
        return a + val;
      }, 0);
      averagePredictionConfidence = Math.round(sum / input.predictionConfidences.length);
    }

    // Standardize input confidences to 0-100 scale for consistency in response
    const standardize = (val: number) => (val <= 1.0 ? Math.round(val * 100) : Math.round(val));
    const dispVal = standardize(input.dispatcherConfidence);
    const gemVal = standardize(input.geminiConfidence);

    // 4. Generate written explanation based on confidence bounds
    let explanation = "High reliability: input reporting contains coordinates, details and high AI model agreement.";
    if (overallConfidence < 40) {
      explanation = "Low reliability: significant reporting data is missing, and AI model inputs carry high uncertainty.";
    } else if (overallConfidence < 75) {
      explanation = "Moderate reliability: complete reporting layout lacks some optional variables or shows slight AI scoring conflicts.";
    }

    return {
      overallConfidence,
      breakdown: {
        dispatcherConfidence: dispVal,
        geminiConfidence: gemVal,
        dataCompleteness: completenessVal,
        predictionConfidence: averagePredictionConfidence,
      },
      explanation,
    };
  }
}

export const confidenceService = new ConfidenceService();
