import { threatClassificationEngine, ThreatDefinition } from "./threat-engine";

export interface NormalizedThreatOutput {
  subtype: string;
  category: string;
  description: string;
  escalationRules: string[];
  baseThreatWeight: number;
  defaultSeverityScore: number;
  criticalFactors: string[];
}

export class ThreatAnalysisService {
  /**
   * Analyzes the incident threat type, resolves its categories, metadata, 
   * and normalizes the output layout for other sub-engines.
   */
  public analyzeThreat(subtype: string): NormalizedThreatOutput {
    const definition: ThreatDefinition = threatClassificationEngine.getThreatDefinition(subtype);

    return {
      subtype: definition.subtype,
      category: definition.category,
      description: definition.description,
      escalationRules: [...definition.escalationRules],
      baseThreatWeight: definition.metadata.baseThreatWeight,
      defaultSeverityScore: definition.metadata.defaultSeverityScore,
      criticalFactors: [...definition.metadata.criticalFactors],
    };
  }
}

export const threatAnalysisService = new ThreatAnalysisService();
