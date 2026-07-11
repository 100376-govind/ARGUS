import { ImpactAssessment } from "./impact-engine";
import { SeverityScoreType } from "./severity-engine";

export interface ProtocolZeroInput {
  overallRiskScore: number;
  severityLevel: SeverityScoreType;
  victimCount: number;
  hasHazmat: boolean;
  isExtremeWeather: boolean;
  isNightTime: boolean;
  impact: ImpactAssessment;
  incidentType: string;
  geminiTriggered: boolean;
  geminiReason: string;
}

export class ProtocolZeroDecisionHelper {
  
  /**
   * Evaluates overall incident risk scores, infrastructure impact telemetry, and Gemini model
   * decisions to check if Protocol Zero (emergency command override) conditions are met.
   */
  public evaluateProtocolZeroTrigger(input: ProtocolZeroInput): {
    triggered: boolean;
    reason: string;
  } {
    // Rule 1: Extreme Risk Score
    if (input.overallRiskScore >= 90.0) {
      return {
        triggered: true,
        reason: `System override: Overall risk score of ${input.overallRiskScore} exceeds extreme safety threshold (90.0).`,
      };
    }

    // Rule 2: Active chemical/combustible threats with operational hospital impact
    if (input.hasHazmat && input.impact.breakdown.hospitals.affectedCount > 0) {
      return {
        triggered: true,
        reason: "System override: Hazardous materials leak detected in close proximity to critical medical facilities.",
      };
    }

    // Rule 3: Mass casualties in extreme conditions
    if (input.victimCount >= 20 && input.isExtremeWeather) {
      return {
        triggered: true,
        reason: `System override: Mass casualties (${input.victimCount}) compounded by severe weather constraints.`,
      };
    }

    // Rule 4: Structural entrapment combined with grid collapse or night evacuation limits
    const isStructuralEntrapment =
      (input.incidentType.includes("collapse") || input.incidentType.includes("earthquake")) &&
      input.impact.breakdown.buildings.structuralIntegrityLost;
      
    if (isStructuralEntrapment && input.isNightTime && input.victimCount > 5) {
      return {
        triggered: true,
        reason: "System override: Large-scale structural collapse and entrapment under zero-light conditions.",
      };
    }

    // Rule 5: Loss of hospital operational status during a geological disaster
    if (
      input.incidentType.includes("earthquake") &&
      input.impact.breakdown.hospitals.affectedCount > 0 &&
      !input.impact.breakdown.hospitals.isOperational
    ) {
      return {
        triggered: true,
        reason: "System override: Seismic event causing direct loss of operational status at local hospitals.",
      };
    }

    // Rule 6: Defer to Gemini assessment override if Gemini specifies clear override criteria
    if (input.geminiTriggered) {
      return {
        triggered: true,
        reason: `Gemini AI Command decision: ${input.geminiReason || "Overriding threat levels specified by AI intelligence."}`,
      };
    }

    return {
      triggered: false,
      reason: "",
    };
  }
}

export const protocolZeroDecisionHelper = new ProtocolZeroDecisionHelper();
