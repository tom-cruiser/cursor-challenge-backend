/**
 * Mint a login JWT for an existing user, for local API testing (no password needed).
 *
 * Usage:
 *   npx tsx scripts/generate-dev-jwt.ts +250788001001
 *   npx tsx scripts/generate-dev-jwt.ts +250788001001 --create   # create a parent user if missing
 */
import 'dotenv/config';
import { db, pool } from '../src/config/database';
import { normalizePhone, signAccessToken } from '../src/services/auth.service';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to mint a dev JWT with NODE_ENV=production.');
  process.exit(1);
}

const rawPhone = process.argv[2];
if (!rawPhone || !rawPhone.startsWith('+')) {
  console.error('Usage: npx tsx scripts/generate-dev-jwt.ts +250788001001 [--create]');
  process.exit(1);
}

async function main(): Promise<void> {
  const phone = normalizePhone(rawPhone);
  let { data: user } = await db.from('users').select('id, phone').eq('phone', phone).maybeSingle();

  if (!user && process.argv.includes('--create')) {
    ({ data: user } = await db
      .from('users')
      .insert({ phone, role: 'parent' })
      .select('id, phone')
      .single());
  }
  if (!user) {
    throw new Error(`No user with phone ${phone}. Pass --create to create one.`);
  }

  console.log(await signAccessToken({ id: user.id, phone: user.phone }));
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  })
  .finally(() => pool.end());
