import { AppError } from "./app-error";

export class RiskEvaluatorError extends AppError {
  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    details?: any
  ) {
    super(statusCode, errorCode, message, details);
  }
}

export class GeminiApiError extends RiskEvaluatorError {
  constructor(message: string, details?: any) {
    super(502, "GEMINI_API_ERROR", message, details);
  }
}

export class GeminiTimeoutError extends RiskEvaluatorError {
  constructor(message: string = "Gemini API request timed out") {
    super(504, "GEMINI_TIMEOUT", message);
  }
}

export class MalformedJsonResponseError extends RiskEvaluatorError {
  constructor(message: string = "Gemini returned invalid or malformed JSON") {
    super(502, "MALFORMED_JSON_RESPONSE", message);
  }
}

export class SchemaValidationError extends RiskEvaluatorError {
  constructor(message: string, details?: any) {
    super(422, "SCHEMA_VALIDATION_FAILED", message, details);
  }
}

export class SafetyBlockError extends RiskEvaluatorError {
  constructor(message: string = "Request blocked by AI Safety filters") {
    super(400, "SAFETY_BLOCK", message);
  }
}

export class PromptInjectionError extends RiskEvaluatorError {
  constructor(message: string = "Potential prompt injection detected in inputs") {
    super(400, "PROMPT_INJECTION_DETECTED", message);
  }
}

export class RateLimitError extends RiskEvaluatorError {
  constructor(message: string = "Gemini API rate limit exceeded") {
    super(429, "RATE_LIMIT_EXCEEDED", message);
  }
}

export class EmptyResponseError extends RiskEvaluatorError {
  constructor(message: string = "Gemini API returned an empty response") {
    super(502, "EMPTY_RESPONSE", message);
  }
}
