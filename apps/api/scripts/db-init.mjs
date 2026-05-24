import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const appRoot = resolve(import.meta.dirname, '..');

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(resolve(appRoot, '.env'));
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for PostgreSQL migrations.');
}

if (
  !databaseUrl.startsWith('postgres://') &&
  !databaseUrl.startsWith('postgresql://')
) {
  throw new Error(`Unsupported DATABASE_URL for db:init: ${databaseUrl}`);
}

const migrationsDir = resolve(appRoot, 'db', 'migrations');
const pool = new Pool({
  connectionString: databaseUrl,
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "schema_migrations" (
      "id" TEXT PRIMARY KEY,
      "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const entries = (await readdir(migrationsDir))
    .filter((entry) => entry.endsWith('.sql'))
    .sort();

  for (const entry of entries) {
    const existing = await pool.query(
      'SELECT 1 FROM "schema_migrations" WHERE "id" = $1 LIMIT 1',
      [entry],
    );

    if (existing.rowCount) {
      continue;
    }

    const sql = await readFile(resolve(migrationsDir, entry), 'utf8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query(
        'INSERT INTO "schema_migrations" ("id") VALUES ($1)',
        [entry],
      );
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  console.log(
    `PostgreSQL schema initialized from ${migrationsDir} using ${entries.length} migration(s).`,
  );
} finally {
  await pool.end();
}
