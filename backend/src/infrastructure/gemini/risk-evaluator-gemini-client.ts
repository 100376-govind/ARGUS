import { GoogleGenAI } from "@google/genai";
import { env } from "@/shared/config/env";
import { logger } from "@/infrastructure/logger/pino";
import { SYSTEM_PROMPT, DEVELOPER_PROMPT } from "@/shared/prompts/base-prompts";
import { promptManager } from "@/shared/prompts/prompt-manager";
import { GeminiRiskEvaluatorResponse } from "@/shared/validation/risk-evaluator-gemini";
import { RiskEvaluatorHelpers } from "@/shared/utils/risk-evaluator-helpers";
import {
  GeminiApiError,
  GeminiTimeoutError,
  RateLimitError,
  SafetyBlockError,
  RiskEvaluatorError,
} from "@/shared/errors/risk-evaluator-errors";

export interface RiskEvaluatorGeminiConfig {
  apiKey: string;
  modelName: string;
  timeoutMs: number;
  maxRetries: number;
  initialBackoffMs: number;
}

export class RiskEvaluatorGeminiClient {
  private static instance: RiskEvaluatorGeminiClient | null = null;
  private readonly ai: GoogleGenAI;
  private readonly config: RiskEvaluatorGeminiConfig;

  public constructor(config?: Partial<RiskEvaluatorGeminiConfig>) {
    this.config = {
      apiKey: config?.apiKey || env.GEMINI_API_KEY,
      modelName: config?.modelName || "gemini-2.5-pro",
      timeoutMs: config?.timeoutMs || 15000, // 15 seconds default timeout
      maxRetries: config?.maxRetries || 3,
      initialBackoffMs: config?.initialBackoffMs || 1000,
    };

    if (!this.config.apiKey || this.config.apiKey === "your-gemini-api-key") {
      throw new GeminiApiError("API key for Google Gemini is not configured correctly");
    }

    this.ai = new GoogleGenAI({ apiKey: this.config.apiKey });
  }

  /**
   * Singleton implementation for direct access.
   */
  public static getInstance(config?: Partial<RiskEvaluatorGeminiConfig>): RiskEvaluatorGeminiClient {
    if (!this.instance) {
      this.instance = new RiskEvaluatorGeminiClient(config);
    }
    return this.instance;
  }

  /**
   * Evaluates the risk of an incident based on its type and structured context.
   */
  public async evaluateRisk(
    incidentId: string,
    incidentType: string,
    structuredContext: Record<string, any>
  ): Promise<GeminiRiskEvaluatorResponse> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const startTime = Date.now();

    // 1. Prompt Preparation
    const template = promptManager.getTemplate(incidentType);
    const incidentPrompt = promptManager.interpolate(template.template, structuredContext);
    
    // Check for prompt injection in the interpolated prompt
    RiskEvaluatorHelpers.detectPromptInjection(incidentPrompt);

    const developerPrompt = promptManager.interpolate(DEVELOPER_PROMPT, {
      incidentContext: incidentPrompt,
    });

    // Validate the prompt length & constraints
    promptManager.validatePrompt(developerPrompt);

    logger.info(
      {
        requestId,
        incidentId,
        incidentType,
        promptVersion: template.version,
        modelName: this.config.modelName,
      },
      "RiskEvaluatorGeminiClient: Initiating AI evaluation"
    );

    let attempt = 0;
    let delay = this.config.initialBackoffMs;

    while (attempt < this.config.maxRetries) {
      attempt++;
      try {
        const resultText = await this.executeWithTimeoutAndRetry(
          requestId,
          developerPrompt,
          attempt
        );

        const evaluation = RiskEvaluatorHelpers.parseAndValidateResponse(resultText);
        const latencyMs = Date.now() - startTime;

        logger.info(
          {
            requestId,
            incidentId,
            latencyMs,
            attempt,
            severity: evaluation.severity,
            priority: evaluation.priority,
            confidence: RiskEvaluatorHelpers.normalizeConfidence(evaluation.confidence),
            success: true,
          },
          "RiskEvaluatorGeminiClient: Evaluation completed successfully"
        );

        return evaluation;
      } catch (error: any) {
        logger.warn(
          {
            requestId,
            incidentId,
            attempt,
            error: error.message,
            errorCode: error.errorCode || "UNKNOWN_ERROR",
          },
          `RiskEvaluatorGeminiClient: Attempt ${attempt} failed`
        );

        // Determine if error is retryable
        const isRetryable = this.isRetryableError(error);
        if (!isRetryable || attempt >= this.config.maxRetries) {
          const latencyMs = Date.now() - startTime;
          logger.error(
            {
              requestId,
              incidentId,
              latencyMs,
              attempts: attempt,
              error: error.message,
              errorCode: error.errorCode || "CRITICAL_FAILURE",
              success: false,
            },
            "RiskEvaluatorGeminiClient: Risk evaluation failed catastrophically"
          );
          throw error;
        }

        // Exponential backoff with jitter
        const jitter = Math.random() * 200 - 100; // Jitter +/- 100ms
        const sleepTime = Math.max(50, delay + jitter);
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
        delay *= 2.0; // Double the backoff window
      }
    }

    throw new GeminiApiError("Failed to assess risk after all retry attempts");
  }

  /**
   * Executes the Gemini model request wrapped with timeout controls.
   */
  private async executeWithTimeoutAndRetry(
    requestId: string,
    developerPrompt: string,
    attempt: number
  ): Promise<string> {
    const apiCallPromise = this.ai.models.generateContent({
      model: this.config.modelName,
      contents: developerPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1, // Highly deterministic outputs
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new GeminiTimeoutError(`Request timed out after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);
    });

    try {
      const response = await Promise.race([apiCallPromise, timeoutPromise]);
      const rawText = response.text;

      if (!rawText) {
        throw new GeminiApiError("Gemini API returned an empty response body");
      }

      return rawText;
    } catch (err: any) {
      if (err instanceof GeminiTimeoutError) {
        throw err;
      }
      
      // Map API/Network/Safety errors to custom error classes
      const message = err.message || "";
      
      if (message.includes("429") || message.includes("quota") || message.toLowerCase().includes("rate limit")) {
        throw new RateLimitError("Gemini API rate limit exceeded");
      }
      
      if (message.toLowerCase().includes("safety") || message.includes("blocked")) {
        throw new SafetyBlockError("Gemini API blocked request due to safety controls");
      }
      
      throw new GeminiApiError(`Gemini API call failed: ${message}`, err);
    }
  }

  /**
   * Evaluates if the error qualifies for a retry sequence.
   */
  private isRetryableError(error: any): boolean {
    // Retry on timeout, rate limits (if configurable/with delay), malformed JSON, and server-side errors
    if (error instanceof GeminiTimeoutError) return true;
    if (error instanceof RateLimitError) return true;
    if (error instanceof GeminiApiError) return true;
    
    const errCode = error.errorCode;
    if (errCode === "MALFORMED_JSON_RESPONSE" || errCode === "GEMINI_API_ERROR") {
      return true;
    }
    
    // Safety blocks and prompt injection should fail immediately without retry
    if (error instanceof SafetyBlockError || error.errorCode === "PROMPT_INJECTION_DETECTED") {
      return false;
    }
    
    return false;
  }
}
