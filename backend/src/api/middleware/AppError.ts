/**
 * AppError
 * Central application error class with HTTP status code and machine-readable error code.
 */
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'BAD_REQUEST',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  public static notFound(message: string, code: string = 'NOT_FOUND'): AppError {
    return new AppError(message, 404, code);
  }

  public static badRequest(message: string, code: string = 'BAD_REQUEST', details?: unknown): AppError {
    return new AppError(message, 400, code, details);
  }

  public static internal(message: string, code: string = 'INTERNAL_ERROR'): AppError {
    return new AppError(message, 500, code);
  }
}
