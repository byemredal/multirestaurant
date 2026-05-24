-- Migration 0017: Delivery coverage & restaurant discovery engine.
--
-- Adds the normalized coverage/discovery model: canonical customer + session
-- addresses, strategy-discriminated store service areas (postal_code / radius /
-- polygon), and per-request discovery logging.
--
-- This migration is ADDITIVE. The legacy "StoreDeliveryZone" table is kept and
-- the new model is backfilled from it, so "StoresService.listPublic" keeps
-- working unchanged. See apps/api/docs/delivery-discovery-engine.md.

-- ===========================================================================
-- Store additions — availability kill-switch + ranking signals
-- ===========================================================================

ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "acceptingOrders" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "isPromoted"      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "discoveryWeight" NUMERIC(5,2) NOT NULL DEFAULT 1.00;

-- ===========================================================================
-- Customer addresses — persistent, owned by a CustomerAccount
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "CustomerAddress" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerAccountId" UUID NOT NULL,
  "label" TEXT,
  "recipientName" TEXT,
  "contactPhone" TEXT,
  "countryCode" CHAR(2) NOT NULL,
  "canton" VARCHAR(64),
  "city" TEXT NOT NULL,
  "postalCode" VARCHAR(16) NOT NULL,
  "street" TEXT,
  "houseNumber" VARCHAR(32),
  "addressLine2" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "formattedAddress" TEXT NOT NULL,
  "deliveryNotes" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CustomerAddress_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "CHK_CustomerAddress_countryCode" CHECK ("countryCode" ~ '^[A-Z]{2}$')
);

CREATE INDEX IF NOT EXISTS "IDX_CustomerAddress_customer"
  ON "CustomerAddress" ("customerAccountId");

-- At most one default address per customer — enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CustomerAddress_default"
  ON "CustomerAddress" ("customerAccountId")
  WHERE "isDefault" = TRUE;

-- ===========================================================================
-- Session addresses — anonymous / pre-login, TTL-bound
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "SessionAddress" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" TEXT NOT NULL UNIQUE,
  "countryCode" CHAR(2) NOT NULL,
  "canton" VARCHAR(64),
  "city" TEXT,
  "postalCode" VARCHAR(16),
  "street" TEXT,
  "houseNumber" VARCHAR(32),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "formattedAddress" TEXT,
  "source" TEXT NOT NULL DEFAULT 'postal_code',
  "claimedByCustomerAccountId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "SessionAddress_claimedBy_fkey"
    FOREIGN KEY ("claimedByCustomerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE SET NULL,
  CONSTRAINT "CHK_SessionAddress_countryCode" CHECK ("countryCode" ~ '^[A-Z]{2}$'),
  CONSTRAINT "CHK_SessionAddress_source"
    CHECK ("source" IN ('postal_code', 'autocomplete', 'geolocation', 'manual'))
);

CREATE INDEX IF NOT EXISTS "IDX_SessionAddress_expiresAt"
  ON "SessionAddress" ("expiresAt");

-- ===========================================================================
-- Store service areas — one delivery rule, strategy-discriminated
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "StoreServiceArea" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "matchStrategy" TEXT NOT NULL DEFAULT 'postal_code',
  "countryCode" CHAR(2) NOT NULL,
  -- radius strategy fields
  "centerLatitude" DOUBLE PRECISION,
  "centerLongitude" DOUBLE PRECISION,
  "radiusKm" NUMERIC(6,2),
  -- delivery economics, per area
  "minimumOrderAmount" NUMERIC(10,2),
  "deliveryFee" NUMERIC(10,2),
  "freeDeliveryThreshold" NUMERIC(10,2),
  "estimatedDeliveryMinutes" INTEGER,
  -- overlap resolution + soft toggle
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  -- traceability back to the legacy zone this area was backfilled from
  "legacyDeliveryZoneId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StoreServiceArea_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
  CONSTRAINT "CHK_StoreServiceArea_countryCode" CHECK ("countryCode" ~ '^[A-Z]{2}$'),
  CONSTRAINT "CHK_StoreServiceArea_strategy"
    CHECK ("matchStrategy" IN ('postal_code', 'radius', 'polygon')),
  -- a radius area must carry a complete circle definition
  CONSTRAINT "CHK_StoreServiceArea_radius" CHECK (
    "matchStrategy" <> 'radius'
    OR ("centerLatitude" IS NOT NULL
        AND "centerLongitude" IS NOT NULL
        AND "radiusKm" IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS "IDX_StoreServiceArea_store"
  ON "StoreServiceArea" ("storeId");

CREATE INDEX IF NOT EXISTS "IDX_StoreServiceArea_strategy_active"
  ON "StoreServiceArea" ("matchStrategy")
  WHERE "isActive" = TRUE;

-- ===========================================================================
-- Postal-code coverage — Phase 1 hot path
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "StoreCoveragePostalCode" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "serviceAreaId" UUID NOT NULL,
  -- storeId denormalized so the match is a single index-only scan, no join
  "storeId" UUID NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "postalCode" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StoreCoveragePostalCode_serviceArea_fkey"
    FOREIGN KEY ("serviceAreaId") REFERENCES "StoreServiceArea" ("id") ON DELETE CASCADE,
  CONSTRAINT "StoreCoveragePostalCode_store_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
  CONSTRAINT "UQ_StoreCoveragePostalCode"
    UNIQUE ("serviceAreaId", "countryCode", "postalCode")
);

CREATE INDEX IF NOT EXISTS "IDX_StoreCoveragePostalCode_lookup"
  ON "StoreCoveragePostalCode" ("countryCode", "postalCode");

CREATE INDEX IF NOT EXISTS "IDX_StoreCoveragePostalCode_store"
  ON "StoreCoveragePostalCode" ("storeId");

-- ===========================================================================
-- Polygon coverage — Phase 3 readiness
-- ===========================================================================
-- Ships now storing raw GeoJSON in JSONB (usable for display today). The
-- PostGIS migration adds a geometry(MultiPolygon, 4326) column + GiST index
-- and backfills it from this column. See docs §8.

CREATE TABLE IF NOT EXISTS "StoreCoveragePolygon" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "serviceAreaId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "geojson" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StoreCoveragePolygon_serviceArea_fkey"
    FOREIGN KEY ("serviceAreaId") REFERENCES "StoreServiceArea" ("id") ON DELETE CASCADE,
  CONSTRAINT "StoreCoveragePolygon_store_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_StoreCoveragePolygon_store"
  ON "StoreCoveragePolygon" ("storeId");

-- ===========================================================================
-- Discovery log — per-request traceability
-- ===========================================================================
-- No foreign keys: logs must survive deletion of the entities they reference.

CREATE TABLE IF NOT EXISTS "DiscoveryLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL,
  "sessionToken" TEXT,
  "customerAccountId" UUID,
  "countryCode" CHAR(2),
  "postalCode" VARCHAR(16),
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "matchStrategies" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "eligibleCount" INTEGER NOT NULL DEFAULT 0,
  "returnedCount" INTEGER NOT NULL DEFAULT 0,
  "unavailableCount" INTEGER NOT NULL DEFAULT 0,
  "rankingVersion" TEXT,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_DiscoveryLog_createdAt"
  ON "DiscoveryLog" ("createdAt");

CREATE INDEX IF NOT EXISTS "IDX_DiscoveryLog_area"
  ON "DiscoveryLog" ("countryCode", "postalCode");

-- ===========================================================================
-- Backfill — legacy StoreDeliveryZone -> normalized coverage model
-- ===========================================================================
-- One postal_code service area per legacy zone (carrying legacyDeliveryZoneId),
-- and one StoreCoveragePostalCode row per element of the JSON postalCodes array.

INSERT INTO "StoreServiceArea" (
  "id", "storeId", "name", "matchStrategy", "countryCode",
  "minimumOrderAmount", "deliveryFee", "estimatedDeliveryMinutes",
  "priority", "isActive", "legacyDeliveryZoneId", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  dz."storeId",
  dz."name",
  'postal_code',
  CASE
    WHEN UPPER(TRIM(COALESCE(s."country", ''))) IN
         ('CH', 'SWITZERLAND', 'SCHWEIZ', 'SUISSE', 'SVIZZERA') THEN 'CH'
    WHEN s."country" ~ '^[A-Za-z]{2}$' THEN UPPER(s."country")
    ELSE 'CH'
  END,
  dz."minimumOrderAmount",
  dz."deliveryFee",
  dz."estimatedDeliveryMinutes",
  100,
  TRUE,
  dz."id",
  dz."createdAt",
  dz."updatedAt"
FROM "StoreDeliveryZone" dz
JOIN "Store" s ON s."id" = dz."storeId"
WHERE NOT EXISTS (
  SELECT 1 FROM "StoreServiceArea" sa
  WHERE sa."legacyDeliveryZoneId" = dz."id"
);

INSERT INTO "StoreCoveragePostalCode" (
  "id", "serviceAreaId", "storeId", "countryCode", "postalCode", "createdAt"
)
SELECT
  gen_random_uuid(),
  sa."id",
  sa."storeId",
  sa."countryCode",
  TRIM(pc.value),
  sa."createdAt"
FROM "StoreServiceArea" sa
JOIN "StoreDeliveryZone" dz ON dz."id" = sa."legacyDeliveryZoneId"
CROSS JOIN LATERAL jsonb_array_elements_text(dz."postalCodes"::jsonb) AS pc(value)
WHERE sa."legacyDeliveryZoneId" IS NOT NULL
  AND dz."postalCodes" IS NOT NULL
  AND TRIM(COALESCE(dz."postalCodes", '')) LIKE '[%'
  AND TRIM(pc.value) <> ''
ON CONFLICT ON CONSTRAINT "UQ_StoreCoveragePostalCode" DO NOTHING;
