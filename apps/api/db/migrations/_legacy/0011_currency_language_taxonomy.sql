-- Migration 0011: Currency + Language tenant assignment tables.
-- The system-level Currency / Language catalogs live in migration 0001.
-- These tables assign which currencies / languages a store offers.

CREATE TABLE IF NOT EXISTS "StoreCurrency" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "currencyId" UUID NOT NULL REFERENCES "Currency"("id") ON DELETE RESTRICT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "customLabel" VARCHAR(120),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_StoreCurrency_store_currency"
    UNIQUE ("storeId", "currencyId")
);

CREATE TABLE IF NOT EXISTS "StoreLanguage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "languageId" UUID NOT NULL REFERENCES "Language"("id") ON DELETE RESTRICT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "customLabel" VARCHAR(120),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_StoreLanguage_store_language"
    UNIQUE ("storeId", "languageId")
);

CREATE INDEX IF NOT EXISTS "IDX_StoreCurrency_storeId"
  ON "StoreCurrency" ("storeId");
CREATE INDEX IF NOT EXISTS "IDX_StoreLanguage_storeId"
  ON "StoreLanguage" ("storeId");
