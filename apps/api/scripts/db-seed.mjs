/**
 * Demo / dev seed runner.
 * Usage: node scripts/db-seed.mjs
 * Env:   DATABASE_URL (required)
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const appRoot = resolve(import.meta.dirname, '..');

if (!process.env.DATABASE_URL && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(resolve(appRoot, '.env'));
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const seedFile = resolve(appRoot, 'db', 'seeds', 'demo-seed.sql');
const sql = await readFile(seedFile, 'utf8');

const pool = new Pool({ connectionString: databaseUrl });
try {
  await pool.query(sql);
  console.log('Demo seed applied successfully.');
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}
