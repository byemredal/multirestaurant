-- 0015 — Installation Profile (single-row).
--
-- Pins which CountryPack this deployment runs and the localization values
-- that were active when the platform was initialized. See
-- `docs/architecture/adr/ADR-country-pack-platform-schema.md` (§2.2).
--
-- Why a new table rather than reusing PlatformSetup:
--   * PlatformSetup mixes branding (platformName/logoUrl/supportEmail) with
--     localization. The country-pack story wants a single, opinionated row
--     answering "what is THE country pack for this deployment?" without
--     dragging branding into every read.
--   * `packVersion` lets the runtime warn/block on code/DB pack drift
--     (the ADR risk #1 mitigation).
--
-- PlatformSetup remains the source of branding for now; SetupStore writes
-- to both in the same transaction. Follow-up sprint can fold branding into
-- InstallationProfile or split branding into its own table.

CREATE TABLE IF NOT EXISTS "InstallationProfile" (
  "id" TEXT PRIMARY KEY DEFAULT 'install' CHECK ("id" = 'install'),
  "countryCode" CHAR(2) NOT NULL,
  "locale" VARCHAR(16) NOT NULL,
  "currencyCode" VARCHAR(8) NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "packVersion" VARCHAR(32) NOT NULL,
  "initializedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "initializedByAdminId" UUID REFERENCES "AdminAccount"("id") ON DELETE SET NULL,
  CONSTRAINT "CHK_InstallationProfile_country"
    CHECK ("countryCode" ~ '^[A-Z]{2}$'),
  CONSTRAINT "CHK_InstallationProfile_currency"
    CHECK ("currencyCode" ~ '^[A-Z]{3}$')
);

-- One-shot backfill for already-initialized environments. Production-fresh
-- installs run setup AFTER this migration and write InstallationProfile via
-- the setup transaction; this clause only fires when PlatformSetup already
-- has a row (existing dev DBs) and InstallationProfile is still empty. The
-- `packVersion` is set to the legacy '0' tag so the runtime can detect drift
-- via packVersionMatches and prompt the operator to re-run setup if needed.
INSERT INTO "InstallationProfile" (
  "id", "countryCode", "locale", "currencyCode", "timezone",
  "packVersion", "initializedAt", "initializedByAdminId"
)
SELECT
  'install',
  ps."primaryCountry",
  COALESCE(ps."defaultLanguage", 'de-CH'),
  COALESCE(ps."defaultCurrency", 'CHF'),
  COALESCE(ps."defaultTimezone", 'Europe/Zurich'),
  'legacy-0',
  ps."initializedAt",
  ps."initializedByAdminId"
FROM "PlatformSetup" ps
WHERE NOT EXISTS (SELECT 1 FROM "InstallationProfile")
ON CONFLICT ("id") DO NOTHING;
