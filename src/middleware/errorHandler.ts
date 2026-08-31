import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError, isAppError } from '../utils/errors';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isProduction = env.NODE_ENV === 'production';

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({ path: e.path, message: e.message })),
    });
    return;
  }

  if (isAppError(err)) {
    // err.details often wraps a raw Supabase/Postgres error object — useful
    // for local debugging, but internal query/constraint detail that must
    // never reach a production client. Always log it server-side though.
    if (err.details) {
      console.error(`AppError ${err.statusCode} ${err.message}:`, err.details);
    }

    res.status(err.statusCode).json({
      error: err.message,
      ...(!isProduction && err.details ? { details: err.details } : {}),
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' });
}
