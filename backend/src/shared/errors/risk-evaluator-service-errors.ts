import { AppError } from "./app-error";

export class RiskEvaluatorServiceError extends AppError {
  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    details?: any
  ) {
    super(statusCode, errorCode, message, details);
  }
}

export class IncidentNotFoundError extends RiskEvaluatorServiceError {
  constructor(incidentId: string) {
    super(404, "INCIDENT_NOT_FOUND", `Incident with ID ${incidentId} was not found`);
  }
}

export class InvalidIncidentError extends RiskEvaluatorServiceError {
  constructor(message: string, details?: any) {
    super(400, "INVALID_INCIDENT", message, details);
  }
}

export class GeminiFailureError extends RiskEvaluatorServiceError {
  constructor(message: string, details?: any) {
    super(502, "GEMINI_FAILURE", message, details);
  }
}

export class InvalidAiResponseError extends RiskEvaluatorServiceError {
  constructor(message: string, details?: any) {
    super(422, "INVALID_AI_RESPONSE", message, details);
  }
}

export class PredictionFailureError extends RiskEvaluatorServiceError {
  constructor(message: string, details?: any) {
    super(500, "PREDICTION_FAILURE", message, details);
  }
}

export class DatabaseError extends RiskEvaluatorServiceError {
  constructor(message: string, details?: any) {
    super(500, "DATABASE_FAILURE", message, details);
  }
}

export class RedisFailureError extends RiskEvaluatorServiceError {
  constructor(message: string, details?: any) {
    super(500, "REDIS_FAILURE", message, details);
  }
}

export class SharedMemoryFailureError extends RiskEvaluatorServiceError {
  constructor(message: string, details?: any) {
    super(500, "SHARED_MEMORY_FAILURE", message, details);
  }
}
