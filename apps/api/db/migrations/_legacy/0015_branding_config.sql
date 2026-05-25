-- Migration 0015: Branding configuration fields.
-- Extends PlatformSetup with the localization defaults that complete the
-- platform branding config. Values are derived from the code-driven country
-- config (packages/config) at initialization time — there is no
-- database-driven country engine.

ALTER TABLE "PlatformSetup"
  ADD COLUMN IF NOT EXISTS "defaultLanguage" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "defaultCurrency" VARCHAR(3),
  ADD COLUMN IF NOT EXISTS "defaultTimezone" VARCHAR(64);

-- Backfill any platform initialized before this migration. The MVP supports
-- Switzerland only, so CH defaults apply.
UPDATE "PlatformSetup"
   SET "defaultLanguage" = COALESCE("defaultLanguage", 'de-CH'),
       "defaultCurrency" = COALESCE("defaultCurrency", 'CHF'),
       "defaultTimezone" = COALESCE("defaultTimezone", 'Europe/Zurich')
 WHERE "primaryCountry" = 'CH';
