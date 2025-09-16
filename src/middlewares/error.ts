import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

interface HttpError extends Error {
  statusCode?: number;
  status?: number;
  code?: string | number;
  details?: unknown;
}

const formatZodIssues = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

export const errorMiddleware = (
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const correlationId = req.id;
  const isZodError = err instanceof ZodError;
  const statusCode =
    typeof err.statusCode === 'number'
      ? err.statusCode
      : typeof err.status === 'number'
        ? err.status
        : isZodError
          ? 400
          : 500;

  const message = err.message || 'Erro interno do servidor';
  const response: Record<string, unknown> = {
    success: false,
    message: isZodError ? 'Dados inválidos fornecidos' : message,
    correlationId,
    timestamp: new Date().toISOString(),
  };

  if (err.code) {
    response.code = err.code;
  }

  if (isZodError) {
    response.errors = formatZodIssues(err);
  } else if (err.details) {
    response.errors = err.details;
  }

  logger.error(
    {
      err,
      statusCode,
      path: req.originalUrl,
      method: req.method,
      correlationId,
    },
    '❌ Erro não tratado',
  );

  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
