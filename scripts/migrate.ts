/**
 * Create the local database (if missing) and apply SQL migrations in order.
 * Applied files are tracked in the `schema_migrations` table, so it is safe to re-run.
 *
 * The row-level-security migration relies on Supabase's `auth.jwt()` function and
 * is skipped: the API connects directly to Postgres and enforces access in code.
 *
 * Usage: npm run migrate
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const SKIP = [/row_level_security/i];
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function ensureDatabase(url: URL): Promise<void> {
  const dbName = decodeURIComponent(url.pathname.slice(1));
  const admin = new URL(url.toString());
  admin.pathname = '/postgres';

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database "${dbName}"`);
    }
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL must be set in .env');

  await ensureDatabase(new URL(connectionString));

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name as string));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (SKIP.some((re) => re.test(file))) {
        console.log(`- skipped ${file} (Supabase-only)`);
        continue;
      }
      if (applied.has(file)) {
        console.log(`- already applied ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✓ applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
