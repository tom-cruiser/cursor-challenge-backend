import { NextFunction, Request, Response } from 'express';
import * as jose from 'jose';
import { supabase } from '../config/database';
import { env } from '../config/env';
import { AuthUser, User } from '../models/types';
import { AppError } from '../utils/errors';
import { getHospitalIdForOwner } from '../services/hospital-admin.service';

function extractPhone(payload: jose.JWTPayload): string | null {
  if (typeof payload.phone === 'string' && payload.phone.length > 0) {
    return payload.phone;
  }

  const sub = payload.sub;
  if (typeof sub === 'string' && sub.startsWith('+')) {
    return sub;
  }

  const userMetadata = payload.user_metadata as Record<string, unknown> | undefined;
  if (userMetadata && typeof userMetadata.phone === 'string') {
    return userMetadata.phone;
  }

  return null;
}

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

async function resolveUser(phone: string): Promise<AuthUser> {
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (fetchError) {
    throw new AppError(500, 'Failed to resolve user', fetchError);
  }

  if (existing) {
    return buildAuthUser(existing as User);
  }

  const { data: created, error: createError } = await supabase
    .from('users')
    .insert({ phone, role: 'parent' })
    .select('*')
    .single();

  if (createError || !created) {
    throw new AppError(500, 'Failed to provision user', createError);
  }

  return buildAuthUser(created as User);
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
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);

    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    const phone = extractPhone(payload);
    if (!phone) {
      throw new AppError(401, 'Token does not contain a valid phone claim');
    }

    req.user = await resolveUser(phone);
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
