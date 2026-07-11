import { SeverityLevel } from "@/domain/entities/risk-evaluator";
import { threatClassificationEngine } from "./threat-engine";

export type SeverityScoreType =
  | "VERY_LOW"
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "CRITICAL"
  | "CATASTROPHIC";

export interface SeverityEvaluationInput {
  incidentType: string;
  victimCount: number;
  hasHazmat: boolean;
  affectedInfrastructure: {
    hasHospitals: boolean;
    hasSchools: boolean;
    hasPowerGrid: boolean;
    hasBridgesOrRoads: boolean;
  };
  environment: {
    isExtremeWeather: boolean;
    isNightTime: boolean;
  };
  geminiAssessedSeverity: SeverityLevel;
}

export class SeverityEngine {
  
  /**
   * Translates a numeric score (0-100) into a severity category level.
   */
  public getSeverityLevel(score: number): SeverityScoreType {
    if (score < 15.0) return "VERY_LOW";
    if (score < 35.0) return "LOW";
    if (score < 55.0) return "MODERATE";
    if (score < 75.0) return "HIGH";
    if (score < 90.0) return "CRITICAL";
    return "CATASTROPHIC";
  }

  /**
   * Helper to map Severity levels to a baseline numeric value.
   */
  public severityLevelToValue(level: SeverityLevel | SeverityScoreType): number {
    switch (level) {
      case "VERY_LOW":
        return 10;
      case "LOW":
        return 25;
      case "MODERATE":
        return 45;
      case "HIGH":
        return 65;
      case "CRITICAL":
        return 80;
      case "CATASTROPHIC":
        return 95;
      default:
        return 25;
    }
  }

  /**
   * Computes the calculated severity score considering multiple structural variables
   * integrated with Gemini AI assessment results.
   */
  public calculateSeverity(input: SeverityEvaluationInput): {
    score: number;
    level: SeverityScoreType;
  } {
    const threatDef = threatClassificationEngine.getThreatDefinition(input.incidentType);
    let score = threatDef.metadata.defaultSeverityScore;

    // 1. Victim Impact Factors
    if (input.victimCount > 0) {
      if (input.victimCount <= 5) {
        score += 10;
      } else if (input.victimCount <= 20) {
        score += 20;
      } else {
        score += 35; // Mass casualty
      }
    }

    // 2. Hazard Proximity & Materials
    if (input.hasHazmat) {
      score += 15;
    }

    // 3. Infrastructure Vulnerabilities
    if (input.affectedInfrastructure.hasHospitals) {
      score += 25;
    }
    if (input.affectedInfrastructure.hasSchools) {
      score += 15;
    }
    if (input.affectedInfrastructure.hasPowerGrid) {
      score += 10;
    }
    if (input.affectedInfrastructure.hasBridgesOrRoads) {
      score += 5;
    }

    // 4. Temporal & Environmental Challenges
    if (input.environment.isExtremeWeather) {
      score += 10;
    }
    if (input.environment.isNightTime) {
      score += 5;
    }

    // Cap the calculated score at 100 before incorporating Gemini insights
    let calculatedScore = Math.min(100, Math.max(0, score));

    // 5. Integrate Gemini AI Assessment (Blend: 60% system rules, 40% AI assessment)
    const geminiValue = this.severityLevelToValue(input.geminiAssessedSeverity);
    const combinedScore = Math.round(calculatedScore * 0.6 + geminiValue * 0.4);

    const finalScore = Math.min(100, Math.max(0, combinedScore));
    const finalLevel = this.getSeverityLevel(finalScore);

    return {
      score: finalScore,
      level: finalLevel,
    };
  }
}

export const severityEngine = new SeverityEngine();
