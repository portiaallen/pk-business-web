export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    code: ApiErrorCode = "INTERNAL_ERROR",
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, "VALIDATION_ERROR", details);
  }

  static unauthorized(message = "Authentication required.") {
    return new ApiError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "You do not have permission to perform this action.") {
    return new ApiError(403, message, "FORBIDDEN");
  }

  static notFound(message = "Resource not found.") {
    return new ApiError(404, message, "NOT_FOUND");
  }

  static conflict(message: string) {
    return new ApiError(409, message, "CONFLICT");
  }

  static rateLimited(message = "Too many requests. Please try again later.") {
    return new ApiError(429, message, "RATE_LIMITED");
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
  }

  console.error("Unhandled API error:", error);

  return {
    status: 500,
    body: {
      error: "An unexpected error occurred.",
      code: "INTERNAL_ERROR" as const,
    },
  };
}
