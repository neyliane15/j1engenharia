import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Encaminha rejeições de handlers async para o middleware de erro. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
