import { GoogleGenAI } from "@google/genai";
import { env } from "@/shared/config/env";
import { logger } from "@/infrastructure/logger/pino";

export interface GeminiReportResponse {
  sitrep: string;
  incidentSummary: string;
  decisionSummary: string;
  complianceStatus: string;
  recommendations: string[];
}

export class GeminiReportService {
  private readonly ai: GoogleGenAI;
  private readonly modelName: string;
  private readonly maxRetries: number = 3;
  private readonly timeoutMs: number = 15000;

  constructor(apiKey?: string, modelName?: string) {
    const key = apiKey || env.GEMINI_API_KEY;
    if (!key || key === "your-gemini-api-key") {
      throw new Error("Gemini API key is not configured");
    }
    this.ai = new GoogleGenAI({ apiKey: key });
    this.modelName = modelName || "gemini-2.5-flash";
  }

  public async generateReport(prompt: string): Promise<GeminiReportResponse> {
    let attempt = 0;

    while (attempt < this.maxRetries) {
      attempt++;
      logger.info({ attempt, model: this.modelName }, "Gemini Report Service: Gemini Request Sent");

      try {
        const responseText = await this.executeRequestWithTimeout(prompt);
        const parsed = this.parseAndValidate(responseText);
        logger.info("Compliance Auditor: Response Validated");
        return parsed;
      } catch (error: any) {
        logger.warn({ attempt, error: error.message }, "Gemini Report Service: Attempt failed, retrying...");
        if (attempt >= this.maxRetries) {
          throw new Error(`Failed to generate report after ${this.maxRetries} attempts: ${error.message}`);
        }
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }

    throw new Error("Failed to generate report");
  }

  private async executeRequestWithTimeout(prompt: string): Promise<string> {
    const apiCall = this.ai.models.generateContent({
      model: this.modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gemini request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });

    const response = await Promise.race([apiCall, timeoutPromise]);
    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    return text;
  }

  private parseAndValidate(text: string): GeminiReportResponse {
    // Basic sanitization to strip any potential markdown formatting
    let cleanText = text.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    const parsed = JSON.parse(cleanText);

    if (
      typeof parsed.sitrep !== "string" ||
      typeof parsed.incidentSummary !== "string" ||
      typeof parsed.decisionSummary !== "string" ||
      typeof parsed.complianceStatus !== "string" ||
      !Array.isArray(parsed.recommendations)
    ) {
      throw new Error("Response JSON does not match the expected GeminiReportResponse schema");
    }

    return parsed as GeminiReportResponse;
  }
}
