/**
 * Set (or reset) the login password for an existing user, e.g. a seeded hospital operator.
 *
 * Usage: npx tsx scripts/set-password.ts +250780000001 'NewPassword123'
 */
import 'dotenv/config';
import { db, pool } from '../src/config/database';
import { normalizePhone, setPassword } from '../src/services/auth.service';

const [rawPhone, password] = process.argv.slice(2);
if (!rawPhone || !password || password.length < 8) {
  console.error("Usage: npx tsx scripts/set-password.ts +250780000001 'password-min-8-chars'");
  process.exit(1);
}

async function main(): Promise<void> {
  const phone = normalizePhone(rawPhone);
  const { data, error } = await db.from('users').select('id, role').eq('phone', phone).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No user with phone ${phone}`);
  await setPassword(data.id, password);
  console.log(`Password set for ${phone} (${data.role})`);
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  })
  .finally(() => pool.end());
