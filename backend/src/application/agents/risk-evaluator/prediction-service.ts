import { predictionEngine, PredictionFactor, GeneratedPrediction } from "./prediction-engine";
import { PredictionFailureError } from "@/shared/errors/risk-evaluator-service-errors";

export class PredictionService {
  /**
   * Orchestrates the prediction engine to generate forecasts on cascades 
   * (e.g. fire/flood spread, casualties, road blockages, hospital loads).
   */
  public getPredictions(factors: PredictionFactor): GeneratedPrediction[] {
    try {
      return predictionEngine.generatePredictions(factors);
    } catch (error: any) {
      throw new PredictionFailureError(`Failed to simulate prediction outcomes: ${error.message}`, error);
    }
  }
}

export const predictionService = new PredictionService();
