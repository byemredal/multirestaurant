import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MR-DB-HARDENING-01 Slice 4 — static guard for the public-discovery index
 * migration. Real index behavior needs a live Postgres (out of scope for unit
 * tests); this locks the migration's intent: it is an indexes-only,
 * non-destructive forward migration that adds the partial active-store index
 * serving StoresService.listPublic, and never uses CONCURRENTLY (the runner
 * wraps each migration in a transaction).
 */
describe('0021 public discovery store index migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../../db/migrations/0021_public_discovery_store_index.sql',
    ),
    'utf8',
  );

  // Executable SQL only — drop full-line `--` comments so prose (e.g. the
  // CONCURRENTLY lock caveat) does not trip the statement-level assertions.
  const executableSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  it('adds the partial active-store index serving listPublic', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS "IDX_Store_public_active_createdAt"/,
    );
    expect(sql).toMatch(/ON "Store" \("createdAt" DESC\)/);
    expect(sql).toMatch(/WHERE "status" = 'active' AND "isActive" = TRUE/);
  });

  it('is indexes-only: no data mutation and no destructive DDL', () => {
    expect(executableSql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
    expect(executableSql).not.toMatch(/\bDROP\b/i);
    expect(executableSql).not.toMatch(/\bALTER TABLE\b/i);
    expect(executableSql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('does not use CONCURRENTLY (runner wraps each migration in a transaction)', () => {
    expect(executableSql).not.toMatch(/CONCURRENTLY/i);
  });

  it('uses IF NOT EXISTS for idempotency', () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
  });
});
