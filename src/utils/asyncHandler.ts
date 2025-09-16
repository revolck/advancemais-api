import type { NextFunction, Request, Response, RequestHandler } from "express";

/**
 * Wraps async route handlers and forwards rejections to Express error middleware.
 */
export const asyncHandler = <T extends RequestHandler>(
  fn: T
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
