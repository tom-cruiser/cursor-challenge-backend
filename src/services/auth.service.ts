import crypto from 'crypto';
import * as jose from 'jose';
import { promisify } from 'util';
import { db } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const DEFAULT_COUNTRY_CODE = '250';

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Local Rwandan format (07XXXXXXXX) -> international.
  if (digits.startsWith('0')) return `+${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  return `+${digits}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export async function signAccessToken(user: { id: string; phone: string }): Promise<string> {
  return new jose.SignJWT({ phone: user.phone })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(new TextEncoder().encode(env.JWT_SECRET));
}

async function setPassword(userId: string, password: string): Promise<void> {
  const { error } = await db
    .from('user_credentials')
    .upsert(
      { user_id: userId, password_hash: await hashPassword(password), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw new AppError(500, 'Failed to store credentials', error);
}

export { setPassword };

export async function registerUser(input: { phone: string; password: string; name?: string }) {
  const phone = normalizePhone(input.phone);

  const { data: existing, error: lookupError } = await db
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  if (lookupError) throw new AppError(500, 'Failed to register user', lookupError);
  if (existing) throw new AppError(409, 'An account with this phone number already exists');

  const { data: created, error } = await db
    .from('users')
    .insert({
      phone,
      role: 'parent',
      name: input.name ?? null,
    })
    .select('*')
    .single();

  if (error || !created) {
    if (error?.code === '23505') {
      throw new AppError(409, 'An account with this phone number already exists');
    }
    throw new AppError(500, 'Failed to register user', error);
  }

  try {
    await setPassword(created.id, input.password);
  } catch (err) {
    await db.from('users').delete().eq('id', created.id);
    throw err;
  }

  return { token: await signAccessToken({ id: created.id, phone }), user: created };
}

export async function loginUser(input: { phone: string; password: string }) {
  const phone = normalizePhone(input.phone);

  const { data: user, error } = await db.from('users').select('*').eq('phone', phone).maybeSingle();
  if (error) throw new AppError(500, 'Failed to sign in', error);

  let storedHash: string | null = null;
  if (user) {
    const { data: creds } = await db
      .from('user_credentials')
      .select('password_hash')
      .eq('user_id', user.id)
      .maybeSingle();
    storedHash = creds?.password_hash ?? null;
  }

  // Same message for unknown phone and wrong password (no account enumeration).
  if (!user || !(await verifyPassword(input.password, storedHash))) {
    throw new AppError(401, 'Invalid phone number or password');
  }

  return { token: await signAccessToken({ id: user.id, phone }), user };
}
