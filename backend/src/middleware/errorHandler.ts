import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('API Error:', err);

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: firstIssue.message,
        field: firstIssue.path.join('.'),
      },
    });
    return;
  }

  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: err.message || 'An unexpected internal server error occurred',
      ...(err.field ? { field: err.field } : {}),
    },
  });
}
