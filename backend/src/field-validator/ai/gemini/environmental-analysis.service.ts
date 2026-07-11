import { GoogleGenAI } from "@google/genai";
import { NetworkFeatures, EnvironmentalInferenceResult } from "../../interfaces/ai-interfaces";
import { OccupancyLikelihood } from "../estimators/occupancy-estimator";
import { InfrastructureAssessment } from "../estimators/infrastructure-assessment.service";
import { GeminiPromptManager } from "./gemini-prompt-manager";
import { FieldValidatorLogger } from "../../utils/field-validator-logger";

export class EnvironmentalAnalysisService {
  private logger = new FieldValidatorLogger("EnvironmentalAnalysisService");
  private ai: GoogleGenAI;
  private readonly MODEL_NAME = "gemini-2.5-flash";

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "mock-key" });
  }

  public async analyze(
    features: NetworkFeatures, 
    occupancyEstimate: OccupancyLikelihood, 
    assessment: InfrastructureAssessment
  ): Promise<EnvironmentalInferenceResult> {
    const prompt = GeminiPromptManager.generatePrompt(features, occupancyEstimate, assessment);
    
    let retries = 2;
    while (retries >= 0) {
      try {
        const startTime = performance.now();
        this.logger.debug("Gemini Request Sent", { retry: 2 - retries });

        const response = await this.ai.models.generateContent({
          model: this.MODEL_NAME,
          contents: prompt,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });

        const duration = performance.now() - startTime;
        this.logger.debug("Gemini Response Received", { durationMs: duration });
        this.logger.performance("geminiCall", duration);

        if (!response.text) throw new Error("Empty response from Gemini");

        const parsed = JSON.parse(response.text.trim());
        const validatedResult = this.validateResponse(parsed);
        
        this.logger.debug("JSON Validated");
        return validatedResult;
      } catch (error) {
        this.logger.warn("Failed to parse or validate Gemini output", { error: (error as Error).message });
        if (retries === 0) {
          this.logger.error("All Gemini retries failed. Falling back to default inference.");
          return this.getFallbackInference(features);
        }
        retries--;
      }
    }
    return this.getFallbackInference(features);
  }

  private validateResponse(parsed: any): EnvironmentalInferenceResult {
    const valStart = performance.now();
    if (!parsed || typeof parsed !== "object") throw new Error("Malformed JSON: Not an object");
    if (!Array.isArray(parsed.environmentalInference)) throw new Error("Malformed JSON: missing environmentalInference array");
    if (typeof parsed.validationConfidence !== "number") throw new Error("Malformed JSON: missing validationConfidence");
    if (typeof parsed.occupancyConfidence !== "number") throw new Error("Malformed JSON: missing occupancyConfidence");
    if (typeof parsed.communicationConfidence !== "number") throw new Error("Malformed JSON: missing communicationConfidence");
    if (typeof parsed.infrastructureConfidence !== "number") throw new Error("Malformed JSON: missing infrastructureConfidence");
    if (typeof parsed.summary !== "string") throw new Error("Malformed JSON: missing summary");
    
    this.logger.performance("jsonValidation", performance.now() - valStart);
    return parsed as EnvironmentalInferenceResult;
  }

  private getFallbackInference(features: NetworkFeatures): EnvironmentalInferenceResult {
    this.logger.warn("Using graceful degradation fallback inference");
    return {
      environmentalInference: ["Network activity suggests possible occupancy.", "Infrastructure state is unknown."],
      validationConfidence: 50,
      occupancyConfidence: features.activeDevices > 0 ? 60 : 30,
      communicationConfidence: 50,
      infrastructureConfidence: features.internetReachability ? 70 : 30,
      summary: "Fallback analysis engaged due to AI reasoning failure."
    };
  }
}
