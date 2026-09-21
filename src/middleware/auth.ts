import { NextFunction, Request, Response } from 'express';
import * as jose from 'jose';
import { db } from '../config/database';
import { env } from '../config/env';
import { AuthUser, User } from '../models/types';
import { AppError } from '../utils/errors';
import { getHospitalIdForOwner } from '../services/hospital-admin.service';

async function buildAuthUser(user: User): Promise<AuthUser> {
  const authUser: AuthUser = {
    id: user.id,
    phone: user.phone,
    role: user.role,
    name: user.name,
  };

  if (user.role === 'hospital') {
    try {
      authUser.hospitalId = await getHospitalIdForOwner(user.id);
    } catch {
      // Hospital operator not yet fully registered
    }
  }

  return authUser;
}

async function resolveUser(userId: string): Promise<AuthUser> {
  const { data: user, error } = await db.from('users').select('*').eq('id', userId).maybeSingle();

  if (error) {
    throw new AppError(500, 'Failed to resolve user', error);
  }
  if (!user) {
    throw new AppError(401, 'Account no longer exists');
  }

  return buildAuthUser(user as User);
}

export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Authorization token required');
    }

    const token = authHeader.slice(7);
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new AppError(401, 'Token does not contain a valid subject');
    }

    req.user = await resolveUser(payload.sub);
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    if (err instanceof jose.errors.JWTExpired) {
      next(new AppError(401, 'Token has expired'));
      return;
    }
    if (err instanceof jose.errors.JWTInvalid) {
      next(new AppError(401, 'Invalid token'));
      return;
    }
    next(new AppError(401, 'Authentication failed'));
  }
}
