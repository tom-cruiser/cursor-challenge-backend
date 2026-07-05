import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../models/types';
import { AppError } from '../utils/errors';

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }

    if (req.user.role !== role) {
      next(new AppError(403, `Access denied: ${role} role required`));
      return;
    }

    next();
  };
}
