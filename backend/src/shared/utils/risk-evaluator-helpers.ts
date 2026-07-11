import { geminiRiskEvaluatorResponseSchema, GeminiRiskEvaluatorResponse } from "../validation/risk-evaluator-gemini";
import { SchemaValidationError, MalformedJsonResponseError, PromptInjectionError } from "../errors/risk-evaluator-errors";

/**
 * Utility class handling AI Safety checks, JSON validation, field recovery,
 * and confidence normalization for the Risk Evaluator.
 */
export class RiskEvaluatorHelpers {
  
  /**
   * Scans input for common prompt injection patterns.
   * Throws a PromptInjectionError if a potential injection is detected.
   */
  public static detectPromptInjection(input: string): void {
    const dangerousPatterns = [
      /\bignore\s+(?:all\s+)?instructions\b/i,
      /\bignore\s+previous\b/i,
      /\bswitch\s+your\s+role\b/i,
      /\byou\s+are\s+now\s+a\b/i,
      /\bnew\s+system\s+instruction\b/i,
      /\bforget\s+(?:what\s+you\b|previous\s+instructions\b)/i,
      /assistant\s*:\s*ignore/i,
      /system\s*:\s*override/i,
      /\boverride\s+system\b/i,
      /\bdo\s+anything\s+now\b/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        throw new PromptInjectionError(`Potential prompt injection matched pattern: ${pattern.source}`);
      }
    }
  }

  /**
   * Sanitizes responses to ensure no sensitive database credentials, API keys, 
   * or system-level environment variables are returned.
   */
  public static sanitizeResponseText(text: string): string {
    let sanitized = text;

    // Remove markdown code blocks (e.g. ```json ... ```)
    sanitized = sanitized.replace(/^```json\s*/i, "");
    sanitized = sanitized.replace(/```$/, "");
    sanitized = sanitized.trim();

    // Sensitive info patterns (keys, secrets, passwords)
    const sensitivePatterns = [
      /sk_test_[a-zA-Z0-9]{24,}/g,
      /AIzaSy[a-zA-Z0-9_-]{33}/g,
      /bearer\s+[a-zA-Z0-9_\-\.\~]+/gi,
      /DATABASE_URL\s*=\s*['"][^'"]+['"]/gi,
    ];

    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, "[REDACTED_SENSITIVE_DATA]");
    }

    return sanitized;
  }

  /**
   * Attempts to parse raw response, recover missing fields if possible,
   * and validate against the Zod schema.
   */
  public static parseAndValidateResponse(rawText: string): GeminiRiskEvaluatorResponse {
    const cleaned = this.sanitizeResponseText(rawText);
    
    let parsedObj: any;
    try {
      parsedObj = JSON.parse(cleaned);
    } catch (e: any) {
      throw new MalformedJsonResponseError(`Failed to parse response JSON: ${e.message}`);
    }

    // Recoverable fields: if a field is missing, assign safe default before validation
    if (parsedObj && typeof parsedObj === "object") {
      if (!parsedObj.predictions || !Array.isArray(parsedObj.predictions)) {
        parsedObj.predictions = [];
      }
      if (!parsedObj.recommendedActions || !Array.isArray(parsedObj.recommendedActions)) {
        parsedObj.recommendedActions = ["Monitor situation for further escalation"];
      }
      if (!parsedObj.protocolZero || typeof parsedObj.protocolZero !== "object") {
        parsedObj.protocolZero = { triggered: false, reason: "" };
      } else {
        if (typeof parsedObj.protocolZero.triggered !== "boolean") {
          parsedObj.protocolZero.triggered = false;
        }
        if (typeof parsedObj.protocolZero.reason !== "string") {
          parsedObj.protocolZero.reason = "";
        }
      }
      if (!parsedObj.metadata || typeof parsedObj.metadata !== "object") {
        parsedObj.metadata = {};
      }
    }

    const validated = geminiRiskEvaluatorResponseSchema.safeParse(parsedObj);
    if (!validated.success) {
      throw new SchemaValidationError("AI response did not match validation schema", validated.error.format());
    }

    return validated.data;
  }

  /**
   * Normalizes confidence values into the range [0 - 100].
   * If value is in range [0.0 - 1.0], it scales it to 100.
   */
  public static normalizeConfidence(confidence: number): number {
    if (confidence < 0) return 0;
    if (confidence <= 1.0) {
      return Math.round(confidence * 100);
    }
    if (confidence > 100) return 100;
    return Math.round(confidence);
  }
}
