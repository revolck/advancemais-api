import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const headerId = req.header("x-correlation-id");
  const correlationId =
    headerId && headerId.trim().length > 0 ? headerId : randomUUID();

  req.id = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);
  res.locals.correlationId = correlationId;

  next();
};
