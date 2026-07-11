export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  static validation(message: string, details?: any): ValidationError {
    return new ValidationError(message, details);
  }

  static unauthorized(message: string = "Unauthorized access"): UnauthorizedError {
    return new UnauthorizedError(message);
  }

  static forbidden(message: string = "Access denied"): ForbiddenError {
    return new ForbiddenError(message);
  }

  static notFound(resource: string, id: string): NotFoundError {
    return new NotFoundError(`${resource} with ID ${id} not found`);
  }

  static conflict(message: string): ConflictError {
    return new ConflictError(message);
  }

  static internal(message: string = "Internal server error", details?: any): InternalServerError {
    return new InternalServerError(message, details);
  }
}


export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized access") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Access denied") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error", details?: any) {
    super(500, "INTERNAL_SERVER_ERROR", message, details);
  }
}

export class BadGatewayError extends AppError {
  constructor(message: string, details?: any) {
    super(502, "BAD_GATEWAY", message, details);
  }
}
