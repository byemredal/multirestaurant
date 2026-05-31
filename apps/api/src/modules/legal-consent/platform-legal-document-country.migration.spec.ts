import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MR-CUSTOMER-LEGAL-COUNTRY-SCOPING-01 — static guard for the country-scope
 * migration. Real column/index behavior needs a live Postgres; this locks the
 * migration's intent: it is a FORWARD-ONLY, ADDITIVE migration that adds a
 * nullable countryCode to PlatformLegalDocument, backfills it from the active
 * InstallationProfile only, adds a lookup index, and never drops anything,
 * never touches the existing UNIQUE("code") contract, and never uses
 * CONCURRENTLY (the runner wraps each migration in a transaction).
 */
describe('0024 platform legal document country migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../../db/migrations/0024_platform_legal_document_country.sql',
    ),
    'utf8',
  );

  const executableSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  it('adds a nullable countryCode column to PlatformLegalDocument', () => {
    expect(sql).toMatch(
      /ALTER TABLE "PlatformLegalDocument"\s+ADD COLUMN IF NOT EXISTS "countryCode" CHAR\(2\)/,
    );
  });

  it('backfills only from the active InstallationProfile (no invented default)', () => {
    expect(executableSql).toMatch(/UPDATE "PlatformLegalDocument"/);
    expect(executableSql).toMatch(/FROM "InstallationProfile"/);
    // No literal country default baked into the backfill.
    expect(executableSql).not.toMatch(/'CH'|'TR'/);
  });

  it('adds a country-aware lookup index', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS "IDX_PlatformLegalDocument_country_audience_active"/,
    );
  });

  it('is non-destructive and preserves the global code uniqueness contract', () => {
    expect(executableSql).not.toMatch(/\bDROP\b/i);
    expect(executableSql).not.toMatch(/\bTRUNCATE\b/i);
    expect(executableSql).not.toMatch(/\bDELETE\b/i);
    // Must not change UNIQUE("code") — country separation uses countryCode +
    // typeCode, not a code-uniqueness swap.
    expect(executableSql).not.toMatch(/UNIQUE/i);
  });

  it('does not use CONCURRENTLY (runner wraps each migration in a transaction)', () => {
    expect(executableSql).not.toMatch(/CONCURRENTLY/i);
  });

  it('uses IF NOT EXISTS for idempotency', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/);
  });
});
