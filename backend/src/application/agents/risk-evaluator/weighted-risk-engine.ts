export interface RiskWeights {
  threatType: number;
  victimCount: number;
  infrastructure: number;
  children: number;
  hospitals: number;
  schools: number;
  hazmat: number;
  weather: number;
  dispatcherConfidence: number;
  geminiConfidence: number;
}

export interface RiskWeightsInput {
  threatSubtype: string;
  victimCount: number;
  hasVulnerablePopulation: boolean; // E.g., children/elderly
  affectedInfrastructureCount: number;
  hasHospitals: boolean;
  hasSchools: boolean;
  hasHazmat: boolean;
  isExtremeWeather: boolean;
  dispatcherConfidence: number; // 0.0 - 100.0 or 0.0 - 1.0
  geminiConfidence: number; // 0.0 - 100.0 or 0.0 - 1.0
}

export class WeightedRiskEngine {
  private weights: RiskWeights;

  constructor(customWeights?: Partial<RiskWeights>) {
    this.weights = {
      threatType: customWeights?.threatType ?? 0.15,
      victimCount: customWeights?.victimCount ?? 0.20,
      infrastructure: customWeights?.infrastructure ?? 0.10,
      children: customWeights?.children ?? 0.10,
      hospitals: customWeights?.hospitals ?? 0.15,
      schools: customWeights?.schools ?? 0.10,
      hazmat: customWeights?.hazmat ?? 0.10,
      weather: customWeights?.weather ?? 0.05,
      dispatcherConfidence: customWeights?.dispatcherConfidence ?? 0.02,
      geminiConfidence: customWeights?.geminiConfidence ?? 0.03,
    };

    this.normalizeWeights();
  }

  private normalizeWeights(): void {
    const total =
      this.weights.threatType +
      this.weights.victimCount +
      this.weights.infrastructure +
      this.weights.children +
      this.weights.hospitals +
      this.weights.schools +
      this.weights.hazmat +
      this.weights.weather +
      this.weights.dispatcherConfidence +
      this.weights.geminiConfidence;

    if (Math.abs(total - 1.0) > 0.001) {
      this.weights.threatType /= total;
      this.weights.victimCount /= total;
      this.weights.infrastructure /= total;
      this.weights.children /= total;
      this.weights.hospitals /= total;
      this.weights.schools /= total;
      this.weights.hazmat /= total;
      this.weights.weather /= total;
      this.weights.dispatcherConfidence /= total;
      this.weights.geminiConfidence /= total;
    }
  }

  /**
   * Reconfigures risk weights dynamically.
   */
  public reconfigure(customWeights: Partial<RiskWeights>): void {
    this.weights = { ...this.weights, ...customWeights };
    this.normalizeWeights();
  }

  /**
   * Returns current active weights.
   */
  public getWeights(): RiskWeights {
    return { ...this.weights };
  }

  /**
   * Computes individual component scores and calculates overall weighted score.
   */
  public calculateRiskScore(input: RiskWeightsInput): {
    overallScore: number;
    breakdown: Record<string, number>;
  } {
    // 1. Threat Type Component (0 - 100)
    // Map threat subtypes to default severity levels
    const baseThreatWeights: Record<string, number> = {
      flash_flood: 85,
      explosion: 90,
      earthquake: 90,
      chemical_leak: 85,
      hospital_emergency: 85,
      urban_fire: 70,
      urban_flood: 60,
      power_failure: 55,
      road_accident: 40,
    };
    const threatScore = baseThreatWeights[input.threatSubtype.toLowerCase()] || 30;

    // 2. Victim Density Component (0 - 100)
    let victimScore = 0;
    if (input.victimCount > 0) {
      if (input.victimCount <= 2) victimScore = 20;
      else if (input.victimCount <= 5) victimScore = 40;
      else if (input.victimCount <= 15) victimScore = 70;
      else victimScore = 100; // Mass disaster
    }

    // 3. Infrastructure general affected (0 - 100)
    const infraScore = Math.min(100, input.affectedInfrastructureCount * 25);

    // 4. Children/Vulnerable pop presence (0 - 100)
    const childrenScore = input.hasVulnerablePopulation || input.hasSchools ? 100 : 0;

    // 5. High sensitivity infrastructures (0 - 100)
    const hospitalScore = input.hasHospitals ? 100 : 0;
    const schoolScore = input.hasSchools ? 100 : 0;

    // 6. Hazmat threat presence (0 - 100)
    const hazmatScore = input.hasHazmat ? 100 : 0;

    // 7. Weather impact multiplier (0 - 100)
    const weatherScore = input.isExtremeWeather ? 100 : 0;

    // 8. Confidence normalization (Ensure 0-100 range)
    const normalizeConfidenceScore = (val: number) => {
      if (val <= 1.0) return val * 100;
      return Math.min(100, Math.max(0, val));
    };
    const dispConfScore = normalizeConfidenceScore(input.dispatcherConfidence);
    const gemConfScore = normalizeConfidenceScore(input.geminiConfidence);

    // 9. Final Summation
    const overallScore =
      threatScore * this.weights.threatType +
      victimScore * this.weights.victimCount +
      infraScore * this.weights.infrastructure +
      childrenScore * this.weights.children +
      hospitalScore * this.weights.hospitals +
      schoolScore * this.weights.schools +
      hazmatScore * this.weights.hazmat +
      weatherScore * this.weights.weather +
      dispConfScore * this.weights.dispatcherConfidence +
      gemConfScore * this.weights.geminiConfidence;

    const finalScore = Math.round(Math.min(100, Math.max(0, overallScore)));

    return {
      overallScore: finalScore,
      breakdown: {
        threatScore,
        victimScore,
        infraScore,
        childrenScore,
        hospitalScore,
        schoolScore,
        hazmatScore,
        weatherScore,
        dispConfScore,
        gemConfScore,
      },
    };
  }
}

export const weightedRiskEngine = new WeightedRiskEngine();
