-- 0004 — Country + platform schema.
--
-- The system catalog (Currency, Language, PaymentMethod, ServiceType) is
-- platform-wide reference data. PlatformSetup, SystemState, SystemSetting and
-- TenantSetting hold the install-level + tenant-level configuration the
-- runtime reads from. CHF is seeded as a first-class currency so the
-- Switzerland MVP works without a separate fix migration.
--
-- The future InstallationProfile + country-pack engine (ADR-country-pack)
-- lands in MR-ARCH-03 — for now we keep the existing PlatformSetup contract.

-- ===========================================================================
-- System catalog
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Currency" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(8) NOT NULL UNIQUE,
  "displayName" VARCHAR(120) NOT NULL,
  "symbol" VARCHAR(8) NOT NULL,
  "numericCode" VARCHAR(8),
  "decimalDigits" SMALLINT NOT NULL DEFAULT 2,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_Currency_code_iso4217" CHECK ("code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "CHK_Currency_decimalDigits" CHECK ("decimalDigits" BETWEEN 0 AND 4)
);

INSERT INTO "Currency" ("code", "displayName", "symbol", "numericCode", "decimalDigits", "sortOrder")
VALUES
  ('CHF', 'Swiss Franc',             'CHF', '756', 2,  5),
  ('TRY', 'Turkish Lira',             '₺', '949', 2, 10),
  ('EUR', 'Euro',                     '€', '978', 2, 20),
  ('USD', 'United States Dollar',     '$', '840', 2, 30),
  ('GBP', 'Pound Sterling',           '£', '826', 2, 40)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "Language" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(16) NOT NULL UNIQUE,
  "displayName" VARCHAR(120) NOT NULL,
  "nativeDisplayName" VARCHAR(120) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_Language_code_bcp47" CHECK ("code" ~ '^[a-z]{2,3}(-[A-Z]{2})?$')
);

INSERT INTO "Language" ("code", "displayName", "nativeDisplayName", "sortOrder")
VALUES
  ('tr-TR', 'Turkish (Turkey)',  'Türkçe',   10),
  ('en-US', 'English (US)',      'English',  20),
  ('de-DE', 'German (Germany)',  'Deutsch',  30),
  ('de-CH', 'German (Switzerland)', 'Deutsch (Schweiz)', 35)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "PaymentMethod" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(40) NOT NULL UNIQUE,
  "displayName" VARCHAR(160) NOT NULL,
  "iconKey" VARCHAR(80),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_PaymentMethod_code_format"
    CHECK ("code" ~ '^[a-z][a-z0-9_]{1,38}$')
);

INSERT INTO "PaymentMethod" ("code", "displayName", "iconKey", "sortOrder")
VALUES
  ('cash',        'Nakit',                 'cash',        10),
  ('credit_card', 'Kredi Kartı (kapıda)',  'card',        20),
  ('online_card', 'Online Kart',           'card-online', 30),
  ('meal_card',   'Yemek Kartı',           'meal-card',   40),
  ('wallet',      'Cüzdan',                'wallet',      50)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "ServiceType" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(40) NOT NULL UNIQUE,
  "displayName" VARCHAR(160) NOT NULL,
  "iconKey" VARCHAR(80),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_ServiceType_code_format"
    CHECK ("code" ~ '^[a-z][a-z0-9_]{1,38}$')
);

INSERT INTO "ServiceType" ("code", "displayName", "iconKey", "sortOrder")
VALUES
  ('delivery', 'Teslimat',   'truck',    10),
  ('pickup',   'Gel-Al',     'bag',      20),
  ('dine_in',  'Restoranda', 'utensils', 30)
ON CONFLICT ("code") DO NOTHING;

-- ===========================================================================
-- Platform setup + system state (single-row tables)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "PlatformSetup" (
  "id" TEXT PRIMARY KEY DEFAULT 'platform' CHECK ("id" = 'platform'),
  "platformName" VARCHAR(120) NOT NULL,
  "supportEmail" VARCHAR(160) NOT NULL,
  "logoUrl" TEXT,
  "primaryCountry" CHAR(2) NOT NULL,
  -- Localization defaults previously added by 0015 ALTER — baked in here.
  "defaultLanguage" VARCHAR(10),
  "defaultCurrency" VARCHAR(3),
  "defaultTimezone" VARCHAR(64),
  "initializedByAdminId" UUID REFERENCES "AdminAccount" ("id") ON DELETE SET NULL,
  "initializedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SystemState" (
  "id" TEXT PRIMARY KEY DEFAULT 'system' CHECK ("id" = 'system'),
  "state" TEXT NOT NULL DEFAULT 'UNINITIALIZED'
    CHECK ("state" IN ('UNINITIALIZED', 'INITIALIZING', 'READY')),
  "initializingStartedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fresh installs start uninitialized; the setup wizard flips this to READY.
INSERT INTO "SystemState" ("id", "state", "updatedAt")
VALUES ('system', 'UNINITIALIZED', NOW())
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" VARCHAR(120) NOT NULL UNIQUE,
  "scope" VARCHAR(40) NOT NULL DEFAULT 'platform',
  "valueJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_SystemSetting_scope"
    CHECK ("scope" IN ('platform', 'admin', 'tenant-default'))
);

CREATE TABLE IF NOT EXISTS "TenantSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL UNIQUE REFERENCES "TenantAccount"("id") ON DELETE CASCADE,
  "defaultLanguage" VARCHAR(16) NOT NULL DEFAULT 'tr',
  "defaultCurrency" VARCHAR(8) NOT NULL DEFAULT 'TRY',
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Istanbul',
  "supportEmail" VARCHAR(255),
  "supportPhone" VARCHAR(40),
  "advancedOptionsJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
