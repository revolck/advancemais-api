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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.ts:22',message:'checking prisma connection error',data:{errorType:error?.constructor?.name,errorCode:(error as any)?.code,isPrismaClientInitializationError:error instanceof PrismaClientInitializationError,isPrismaClientKnownRequestError:error instanceof PrismaClientKnownRequestError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (error instanceof PrismaClientInitializationError) {
    const message = error.message.toLowerCase();
    const result = (
      message.includes('tenant or user not found') ||
      message.includes('connection') ||
      message.includes("can't reach database") ||
      message.includes('fatal')
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.ts:30',message:'PrismaClientInitializationError check result',data:{result,message:error.message.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return result;
  }
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.ts:33',message:'not PrismaClientInitializationError, checking PrismaClientKnownRequestError',data:{errorCode:(error as any)?.code,isPrismaClientKnownRequestError:error instanceof PrismaClientKnownRequestError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  // Check PrismaClientKnownRequestError with P1001 code
  if (error instanceof PrismaClientKnownRequestError) {
    const isP1001 = (error as any).code === 'P1001';
    const message = error.message.toLowerCase();
    const result = isP1001 || (
      message.includes('tenant or user not found') ||
      message.includes('connection') ||
      message.includes("can't reach database") ||
      message.includes('fatal')
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.ts:42',message:'PrismaClientKnownRequestError check result',data:{result,isP1001,code:(error as any).code,message:error.message.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return result;
  }
  
  // ✅ Verificar também erros genéricos com código P1001 ou P2024
  const errorCode = (error as any)?.code;
  const errorMessage = String((error as any)?.message || '').toLowerCase();
  if (errorCode === 'P1001' || errorCode === 'P2024' || 
      errorMessage.includes("can't reach database") ||
      errorMessage.includes('database server') ||
      errorMessage.includes('connection')) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.ts:57',message:'generic error with P1001/P2024 detected',data:{errorCode,errorMessage:errorMessage.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return true;
  }
  
  return false;
};

export const errorMiddleware = (
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.ts:60',message:'errorMiddleware called',data:{errorType:err?.constructor?.name,errorCode:(err as any)?.code,errorMessage:(err as any)?.message?.substring(0,200),path:req.path,method:req.method},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  const correlationId = req.id;
  const isZodError = err instanceof ZodError;
  const isPrismaConnection = isPrismaConnectionError(err);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.ts:68',message:'errorMiddleware connection check',data:{isPrismaConnection,errorCode:(err as any)?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'error.ts:85',message:'errorMiddleware returning 503 for connection error',data:{errorCode:(err as any)?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
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
