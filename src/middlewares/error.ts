import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
} from '@prisma/client/runtime/library';
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

const isPrismaConnectionError = (error: unknown): boolean => {
  if (error instanceof PrismaClientInitializationError) {
    const message = error.message.toLowerCase();
    return (
      message.includes('tenant or user not found') ||
      message.includes('connection') ||
      message.includes("can't reach database") ||
      message.includes('fatal')
    );
  }
  return false;
};

export const errorMiddleware = (
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const correlationId = req.id;
  const isZodError = err instanceof ZodError;
  const isPrismaConnection = isPrismaConnectionError(err);

  // Determinar status code
  let statusCode: number;
  if (typeof err.statusCode === 'number') {
    statusCode = err.statusCode;
  } else if (typeof err.status === 'number') {
    statusCode = err.status;
  } else if (isZodError) {
    statusCode = 400;
  } else if (isPrismaConnection) {
    statusCode = 503; // Service Unavailable para erros de conexão
  } else if (err instanceof PrismaClientKnownRequestError) {
    // Erros conhecidos do Prisma (ex: unique constraint, foreign key)
    if (err.code === 'P2002') {
      statusCode = 409; // Conflict
    } else if (err.code === 'P2025') {
      statusCode = 404; // Not Found
    } else {
      statusCode = 400; // Bad Request
    }
  } else {
    statusCode = 500;
  }

  // Determinar mensagem
  let message = err.message || 'Erro interno do servidor';
  if (isPrismaConnection) {
    message = 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.';
  } else if (isZodError) {
    message = 'Dados inválidos fornecidos';
  }

  const response: Record<string, unknown> = {
    success: false,
    message,
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
      isPrismaConnection,
    },
    isPrismaConnection ? '⚠️ Erro de conexão com banco de dados' : '❌ Erro não tratado',
  );

  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
