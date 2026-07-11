import { PriorityLevel } from "@/domain/entities/risk-evaluator";

export type PriorityCode = "P1" | "P2" | "P3" | "P4" | "P5";

export interface PriorityCalculatorConfig {
  severityWeight: number; // e.g., 0.5
  impactWeight: number; // e.g., 0.3
  timeUrgencyWeight: number; // e.g., 0.2
}

export interface PriorityEvaluationInput {
  severityScore: number; // 0 - 100
  impactScore: number; // 0 - 100 (from Impact Engine)
  timeUrgencyScore: number; // 0 - 100 (e.g., immediate threat = 100, >12h = 20)
}

export class PriorityEngine {
  private config: PriorityCalculatorConfig;

  constructor(config?: Partial<PriorityCalculatorConfig>) {
    this.config = {
      severityWeight: config?.severityWeight ?? 0.5,
      impactWeight: config?.impactWeight ?? 0.3,
      timeUrgencyWeight: config?.timeUrgencyWeight ?? 0.2,
    };

    // Ensure weights add up to 1.0
    const total = this.config.severityWeight + this.config.impactWeight + this.config.timeUrgencyWeight;
    if (Math.abs(total - 1.0) > 0.001) {
      // Normalize weights
      this.config.severityWeight /= total;
      this.config.impactWeight /= total;
      this.config.timeUrgencyWeight /= total;
    }
  }

  /**
   * Reconfigures priority calculation weights dynamically.
   */
  public configure(newConfig: Partial<PriorityCalculatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    const total = this.config.severityWeight + this.config.impactWeight + this.config.timeUrgencyWeight;
    if (Math.abs(total - 1.0) > 0.001) {
      this.config.severityWeight /= total;
      this.config.impactWeight /= total;
      this.config.timeUrgencyWeight /= total;
    }
  }

  /**
   * Returns current config weights.
   */
  public getConfig(): PriorityCalculatorConfig {
    return { ...this.config };
  }

  /**
   * Translates a numeric priority score (0-100) into a P1-P5 PriorityCode.
   */
  public getPriorityCode(score: number): PriorityCode {
    if (score >= 85.0) return "P1";
    if (score >= 65.0) return "P2";
    if (score >= 45.0) return "P3";
    if (score >= 25.0) return "P4";
    return "P5";
  }

  /**
   * Maps PriorityCode to standard domain PriorityLevel.
   */
  public mapToPriorityLevel(code: PriorityCode): PriorityLevel {
    switch (code) {
      case "P1":
        return "CRITICAL";
      case "P2":
        return "HIGH";
      case "P3":
        return "MEDIUM";
      case "P4":
        return "LOW";
      case "P5":
        return "LOW"; // Map P5 back to LOW for structural simplicity or keep it aligned
      default:
        return "MEDIUM";
    }
  }

  /**
   * Calculates the priority code and numeric score.
   */
  public calculatePriority(input: PriorityEvaluationInput): {
    score: number;
    code: PriorityCode;
    level: PriorityLevel;
  } {
    const calculatedScore =
      input.severityScore * this.config.severityWeight +
      input.impactScore * this.config.impactWeight +
      input.timeUrgencyScore * this.config.timeUrgencyWeight;

    const score = Math.round(Math.min(100, Math.max(0, calculatedScore)));
    const code = this.getPriorityCode(score);
    const level = this.mapToPriorityLevel(code);

    return {
      score,
      code,
      level,
    };
  }
}

export const priorityEngine = new PriorityEngine();
