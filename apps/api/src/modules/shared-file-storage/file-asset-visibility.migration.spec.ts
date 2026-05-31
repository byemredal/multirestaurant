import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MR-DB-HARDENING-01 Slice 3 — static guard for the FileAsset visibility
 * migration. The DB behavior needs a live Postgres (out of scope for unit
 * tests); this locks the migration's intent: add a safe-by-default visibility
 * column, backfill public/private from the existing references, constrain the
 * allowed values, and never delete data or drop publicUrl.
 */
describe('0022 FileAsset visibility migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../../db/migrations/0022_file_asset_visibility.sql'),
    'utf8',
  );

  // Executable SQL only — drop full-line `--` comments so prose does not trip
  // the statement-level negative assertions.
  const executableSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  it('adds a safe-by-default visibility column', () => {
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'tenant_private'/,
    );
  });

  it('backfills slider-only assets as public (TenantDocument-referenced stay private)', () => {
    expect(sql).toMatch(/UPDATE "FileAsset"[\s\S]*SET "visibility" = 'public'/);
    expect(sql).toMatch(/"StoreSliderItem" si WHERE si\."imageAssetId" = fa\."id"/);
    expect(sql).toMatch(
      /NOT EXISTS \(\s*SELECT 1 FROM "TenantDocument" td WHERE td\."fileAssetId" = fa\."id"/,
    );
  });

  it('constrains allowed values with a CHECK', () => {
    expect(sql).toMatch(/"CHK_FileAsset_visibility"/);
    expect(sql).toMatch(/CHECK \("visibility" IN \('public', 'tenant_private'\)\)/);
  });

  it('does not delete data and does not drop publicUrl', () => {
    expect(executableSql).not.toMatch(/\bDELETE\b/i);
    expect(executableSql).not.toMatch(/\bTRUNCATE\b/i);
    expect(executableSql).not.toMatch(/\bDROP\b/i);
    expect(executableSql).not.toMatch(/publicUrl/);
  });
});
