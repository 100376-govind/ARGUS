import { EvidenceSource, EvidenceWeight } from "../models/evidence-models";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export class EvidenceWeightEngine {
  private logger = new FieldValidatorLogger("EvidenceWeightEngine");
  
  private weights: Map<EvidenceSource, number> = new Map([
    [EvidenceSource.CitizenReport, 0.25],
    [EvidenceSource.RiskEvaluator, 0.20],
    [EvidenceSource.Weather, 0.15],
    [EvidenceSource.GoogleSearch, 0.15],
    [EvidenceSource.GoogleMaps, 0.10],
    [EvidenceSource.HistoricalIncidents, 0.05],
    [EvidenceSource.NetworkIntelligence, 0.10]
  ]);

  public getWeight(source: EvidenceSource): number {
    return this.weights.get(source) || 0;
  }

  public updateWeights(newWeights: Partial<Record<EvidenceSource, number>>): void {
    this.logger.info("Updating evidence configuration weights");
    for (const [source, weight] of Object.entries(newWeights)) {
      if (weight !== undefined && weight >= 0 && weight <= 1) {
        this.weights.set(source as EvidenceSource, weight);
      }
    }
    this.validateWeights();
  }

  private validateWeights(): void {
    let total = 0;
    this.weights.forEach(val => total += val);
    if (Math.abs(total - 1.0) > 0.001) {
      this.logger.warn(`Total configured weights sum up to ${total} instead of 1.0 (100%). Score scaling may occur.`);
    }
  }

  public getAllWeights(): EvidenceWeight[] {
    const list: EvidenceWeight[] = [];
    this.weights.forEach((weight, source) => {
      list.push({ source, weight });
    });
    return list;
  }
}
