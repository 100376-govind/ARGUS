import { SeverityScoreType } from "./severity-engine";
import { PriorityCode } from "./priority-engine";
import { GeneratedPrediction } from "./prediction-engine";

export interface ReasoningInput {
  severityLevel: SeverityScoreType;
  priorityCode: PriorityCode;
  incidentType: string;
  victimCount: number;
  hasHazmat: boolean;
  isExtremeWeather: boolean;
  affectedInfrastructure: string[];
  predictions: GeneratedPrediction[];
  geminiReasoning: string;
}

export class ReasoningEngine {
  
  /**
   * Generates a concise list of objective bulleted statements explaining the 
   * final risk and priority assessments. Strictly prevents exposure of chain-of-thought.
   */
  public generateConciseReasoning(input: ReasoningInput): {
    bullets: string[];
    summary: string;
  } {
    const bullets: string[] = [];

    // 1. Core Threat Hazard Bullet
    const formattedType = input.incidentType.replace(/_/g, " ");
    bullets.push(`Critical incident type identified: ${formattedType}`);

    // 2. Victim & Life Safety Bullet
    if (input.victimCount > 0) {
      bullets.push(`Life safety threat confirmed: ${input.victimCount} victims reported`);
    } else {
      bullets.push(`No civilian casualties confirmed at initial dispatch`);
    }

    // 3. Environmental & Hazmat Context
    if (input.hasHazmat) {
      bullets.push(`Hazardous materials or combustible leaks active at zone`);
    }
    if (input.isExtremeWeather) {
      bullets.push(`Rescue hampered by active extreme weather conditions`);
    }

    // 4. Critical Infrastructure Impact
    if (input.affectedInfrastructure.length > 0) {
      bullets.push(`Impact on key infrastructure: ${input.affectedInfrastructure.join(", ")}`);
    }

    // 5. Critical Predictions
    const highProbPredictions = input.predictions.filter((p) => p.probability > 0.6);
    for (const pred of highProbPredictions) {
      const predLabel = pred.threatType.replace(/_/g, " ");
      bullets.push(`High risk of escalation: ${predLabel} (probability: ${Math.round(pred.probability * 100)}%)`);
    }

    // 6. Action-Priority Summary
    bullets.push(`Priority allocation determined: ${input.priorityCode} (${input.severityLevel} severity)`);

    // Clean summary based on bullets
    const summary = bullets.join(" | ");

    return {
      bullets,
      summary,
    };
  }
}

export const reasoningEngine = new ReasoningEngine();
