/**
 * Mint a Supabase-compatible HS256 JWT for local API testing.
 * Uses SUPABASE_JWT_SECRET from .env — no real OTP required.
 *
 * Usage:
 *   npx tsx scripts/generate-dev-jwt.ts +250788001001
 *   npx tsx scripts/generate-dev-jwt.ts +250788001001 --hours 24
 */
import 'dotenv/config';
import * as jose from 'jose';

const phone = process.argv[2];
const hoursArg = process.argv.indexOf('--hours');
const hours = hoursArg >= 0 ? Number(process.argv[hoursArg + 1]) : 24;

if (!phone || !phone.startsWith('+')) {
  console.error('Usage: npx tsx scripts/generate-dev-jwt.ts +250788001001 [--hours 24]');
  process.exit(1);
}

const secret = process.env.SUPABASE_JWT_SECRET;
if (!secret) {
  console.error('SUPABASE_JWT_SECRET is not set in .env');
  process.exit(1);
}

async function main(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const token = await new jose.SignJWT({
    phone,
    role: 'authenticated',
    user_metadata: { phone },
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(phone)
    .setIssuedAt(now)
    .setExpirationTime(now + hours * 3600)
    .setAudience('authenticated')
    .sign(new TextEncoder().encode(secret));

  console.log(token);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
