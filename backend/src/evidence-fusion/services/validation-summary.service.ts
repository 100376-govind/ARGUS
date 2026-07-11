import { GoogleGenAI } from "@google/genai";
import { EvidenceResult } from "../models/evidence-models";
import { FieldValidatorLogger } from "../../field-validator/utils/field-validator-logger";

export interface GeminiSummaryResult {
  summary: string;
  supportingObservations: string[];
  conflictingObservations: string[];
  finalRecommendation: string;
}

export class ValidationSummaryService {
  private logger = new FieldValidatorLogger("ValidationSummaryService");
  private ai: GoogleGenAI;
  private readonly MODEL_NAME = "gemini-2.5-flash";

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "mock-key" });
  }

  public async generateSummary(
    evidences: EvidenceResult[],
    detectedConflicts: string[],
    detectedSupports: string[]
  ): Promise<GeminiSummaryResult> {
    const prompt = this.generatePrompt(evidences, detectedConflicts, detectedSupports);
    
    let retries = 2;
    while (retries >= 0) {
      try {
        const startTime = performance.now();
        this.logger.debug("Gemini Summary Request Sent", { retry: 2 - retries });

        const response = await this.ai.models.generateContent({
          model: this.MODEL_NAME,
          contents: prompt,
          config: {
            temperature: 0.15,
            responseMimeType: "application/json"
          }
        });

        const duration = performance.now() - startTime;
        this.logger.performance("geminiSummaryCall", duration);

        if (!response.text) throw new Error("Empty response from Gemini");

        const parsed = JSON.parse(response.text.trim());
        const validated = this.validateResponse(parsed);
        
        return validated;
      } catch (error) {
        this.logger.warn("Failed to parse Gemini validation summary. Retrying...", { error: (error as Error).message });
        if (retries === 0) {
          this.logger.error("Gemini summary failed after all retries. Executing fallback summary.");
          return this.getFallbackSummary(evidences, detectedConflicts, detectedSupports);
        }
        retries--;
      }
    }
    return this.getFallbackSummary(evidences, detectedConflicts, detectedSupports);
  }

  private generatePrompt(evidences: EvidenceResult[], conflicts: string[], supports: string[]): string {
    const formattedEvidence = evidences.map(e => {
      return `- Source: ${e.source}\n  Confidence: ${e.confidence}%\n  Status: ${e.status}\n  Observations: ${e.observations.join(", ")}`;
    }).join("\n");

    return `
You are the ARGUS Evidence Fusion Engine AI.
Analyze the following list of validation evidence, static conflicts, and supporting records, and generate a concise validation summary.

# RULES
1. NEVER hallucinate.
2. NEVER expose chain-of-thought or markdown formatting outside of the requested JSON.
3. RETURN ONLY VALID JSON. No backticks, no markdown blocks.
4. Keep observations and final recommendation extremely concise. Max 5 observations total.
5. Max 1 sentence for finalRecommendation.

# INPUT EVIDENCE
${formattedEvidence}

# STATIC ANALYZED OBSERVATIONS
- Supporting: ${supports.join(", ") || "None"}
- Conflicting: ${conflicts.join(", ") || "None"}

# EXPECTED JSON SCHEMA
{
  "summary": "string summary",
  "supportingObservations": ["string"],
  "conflictingObservations": ["string"],
  "finalRecommendation": "string recommendation"
}
`;
  }

  private validateResponse(parsed: any): GeminiSummaryResult {
    if (!parsed || typeof parsed !== "object") throw new Error("Result is not an object");
    if (typeof parsed.summary !== "string") throw new Error("Missing summary");
    if (!Array.isArray(parsed.supportingObservations)) throw new Error("Missing supportingObservations");
    if (!Array.isArray(parsed.conflictingObservations)) throw new Error("Missing conflictingObservations");
    if (typeof parsed.finalRecommendation !== "string") throw new Error("Missing finalRecommendation");
    return parsed as GeminiSummaryResult;
  }

  private getFallbackSummary(evidences: EvidenceResult[], conflicts: string[], supports: string[]): GeminiSummaryResult {
    return {
      summary: "Completed evidence consolidation under fallback mode.",
      supportingObservations: supports.length > 0 ? supports : ["Corroborating indicators observed across sources."],
      conflictingObservations: conflicts.length > 0 ? conflicts : ["Minor data variance noted."],
      finalRecommendation: "Monitor the dispatch queue and request field feedback."
    };
  }
}
