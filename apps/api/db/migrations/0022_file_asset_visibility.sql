-- 0022 — FileAsset visibility / privacy model (MR-DB-HARDENING-01 Slice 3).
--
-- FileAsset is shared by PUBLIC assets (StoreSliderItem.imageAssetId) and
-- PRIVATE tenant documents (TenantDocument.fileAssetId — onboarding / KYC /
-- bank / legal). Until now there was no classification, so a sensitive document
-- and a public banner image were indistinguishable at the data layer.
--
-- This migration adds a `visibility` classification, backfills it from the
-- existing references, and constrains the allowed values. It does NOT rename or
-- drop `publicUrl` (kept for backward compatibility) and does NOT delete data.
--
-- Backfill rules (safe-by-default):
--   • Column DEFAULT 'tenant_private' → every existing and future row starts
--     private unless proven public.
--   • A row referenced by StoreSliderItem AND NOT by TenantDocument → 'public'.
--   • A row referenced by TenantDocument → stays 'tenant_private' (default).
--   • A row referenced by BOTH (ambiguous) → stays 'tenant_private' (safer).
--   • A row referenced by neither → stays 'tenant_private' (safer).

-- 1. Add the column. NOT NULL DEFAULT backfills all existing rows as private.
ALTER TABLE "FileAsset"
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'tenant_private';

-- 2. Promote only unambiguously-public assets: referenced by a slider item and
--    never used as a tenant document. (Backfill UPDATE — not a deletion.)
UPDATE "FileAsset" fa
   SET "visibility" = 'public'
 WHERE EXISTS (
         SELECT 1 FROM "StoreSliderItem" si WHERE si."imageAssetId" = fa."id"
       )
   AND NOT EXISTS (
         SELECT 1 FROM "TenantDocument" td WHERE td."fileAssetId" = fa."id"
       );

-- 3. Constrain allowed values (guarded so the migration is re-runnable).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CHK_FileAsset_visibility'
  ) THEN
    ALTER TABLE "FileAsset"
      ADD CONSTRAINT "CHK_FileAsset_visibility"
        CHECK ("visibility" IN ('public', 'tenant_private'));
  END IF;
END $$;

-- Partial index for the (rare) public-asset lookups; keeps the common private
-- set out of the index. Cheap and supports any future "list public assets" path.
CREATE INDEX IF NOT EXISTS "IDX_FileAsset_public"
  ON "FileAsset" ("id")
  WHERE "visibility" = 'public';
