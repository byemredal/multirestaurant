-- Migration 0012: ServiceType tenant assignment table.
-- The system-level PaymentMethod / ServiceType catalogs live in migration 0001.
-- This table assigns which service types a store offers.

CREATE TABLE IF NOT EXISTS "StoreServiceType" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "serviceTypeId" UUID NOT NULL REFERENCES "ServiceType"("id") ON DELETE RESTRICT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "customLabel" VARCHAR(120),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_StoreServiceType_store_serviceType"
    UNIQUE ("storeId", "serviceTypeId")
);

CREATE INDEX IF NOT EXISTS "IDX_StoreServiceType_storeId"
  ON "StoreServiceType" ("storeId");
