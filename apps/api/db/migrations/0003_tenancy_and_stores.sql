-- 0003 — Tenancy and stores.
--
-- A Store is a tenant-owned operational location. This file lays down the
-- Store row itself (with the discovery columns from the old 0017 baked in),
-- legacy delivery zones (kept for current code paths), the normalized
-- coverage/discovery model, customer + session addresses, plus tenant-side
-- staff and device records.

-- ===========================================================================
-- Store
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Store" (
  "id" UUID NOT NULL PRIMARY KEY,
  "ownerTenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "status" TEXT NOT NULL,
  "onboardingStatus" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "postalCode" TEXT,
  "country" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "phoneNumber" TEXT,
  -- Discovery/ranking columns previously added by 0017 ALTER — baked in here.
  "acceptingOrders" BOOLEAN NOT NULL DEFAULT TRUE,
  "isPromoted" BOOLEAN NOT NULL DEFAULT FALSE,
  "discoveryWeight" NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Store_ownerTenantId_fkey"
    FOREIGN KEY ("ownerTenantId") REFERENCES "TenantAccount" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Store_ownerTenantId_createdAt_idx"
  ON "Store" ("ownerTenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "StoreOpeningHour" (
  "id" UUID NOT NULL PRIMARY KEY,
  "storeId" UUID NOT NULL,
  "dayOfWeek" TEXT NOT NULL,
  "openTime" TEXT NOT NULL,
  "closeTime" TEXT NOT NULL,
  "isClosed" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "StoreOpeningHour_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "StoreOpeningHour_storeId_dayOfWeek_idx"
  ON "StoreOpeningHour" ("storeId", "dayOfWeek");

-- ===========================================================================
-- LEGACY: StoreDeliveryZone — superseded by StoreServiceArea (see below).
-- Kept because `StoresService.listPublic` and tenant onboarding still read
-- from it. Scheduled for removal once consumers move to StoreServiceArea.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "StoreDeliveryZone" (
  "id" UUID NOT NULL PRIMARY KEY,
  "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "postalCodes" TEXT NOT NULL,
  "radiusKm" DOUBLE PRECISION,
  "minimumOrderAmount" DOUBLE PRECISION,
  "deliveryFee" DOUBLE PRECISION,
  "estimatedDeliveryMinutes" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "StoreDeliveryZone_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "StoreDeliveryZone_storeId_idx"
  ON "StoreDeliveryZone" ("storeId");

-- ===========================================================================
-- Customer + session addresses
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
-- Normalized service-area + coverage model
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
  -- traceability back to a legacy zone (NULL on fresh installs)
  "legacyDeliveryZoneId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "StoreServiceArea_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
  CONSTRAINT "CHK_StoreServiceArea_countryCode" CHECK ("countryCode" ~ '^[A-Z]{2}$'),
  CONSTRAINT "CHK_StoreServiceArea_strategy"
    CHECK ("matchStrategy" IN ('postal_code', 'radius', 'polygon')),
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

CREATE TABLE IF NOT EXISTS "StoreCoveragePostalCode" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "serviceAreaId" UUID NOT NULL,
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
-- Staff + device records (tenant-scoped, optionally store-scoped)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "StaffAccount" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "TenantAccount"("id") ON DELETE CASCADE,
  "storeId" UUID REFERENCES "Store"("id") ON DELETE CASCADE,
  "email" VARCHAR(255),
  "fullName" VARCHAR(255) NOT NULL,
  "phoneNumber" VARCHAR(40),
  "staffType" VARCHAR(32) NOT NULL,
  "employmentStatus" VARCHAR(32) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StaffAccount_staffType"
    CHECK ("staffType" IN ('cashier', 'delivery_admin', 'kitchen', 'manager', 'host', 'other')),
  CONSTRAINT "CHK_StaffAccount_employmentStatus"
    CHECK ("employmentStatus" IN ('active', 'invited', 'suspended'))
);

CREATE INDEX IF NOT EXISTS "IDX_StaffAccount_tenantId" ON "StaffAccount" ("tenantId");
CREATE INDEX IF NOT EXISTS "IDX_StaffAccount_storeId" ON "StaffAccount" ("storeId");

CREATE TABLE IF NOT EXISTS "StaffSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId" UUID NOT NULL UNIQUE REFERENCES "StaffAccount"("id") ON DELETE CASCADE,
  "preferredLanguage" VARCHAR(16) NOT NULL DEFAULT 'tr',
  "theme" VARCHAR(32) NOT NULL DEFAULT 'system',
  "uiPreferencesJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "StaffSecuritySetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId" UUID NOT NULL UNIQUE REFERENCES "StaffAccount"("id") ON DELETE CASCADE,
  "pinHash" VARCHAR(255),
  "pinUpdatedAt" TIMESTAMPTZ,
  "mfaEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "KitchenStaffProfile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId" UUID NOT NULL UNIQUE REFERENCES "StaffAccount"("id") ON DELETE CASCADE,
  "stationLabel" VARCHAR(120),
  "assignedMenuCategoryIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "receivesExpediteAlerts" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "POSDevice" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "TenantAccount"("id") ON DELETE CASCADE,
  "storeId" UUID REFERENCES "Store"("id") ON DELETE CASCADE,
  "deviceName" VARCHAR(160) NOT NULL,
  "externalIdentifier" VARCHAR(160),
  "connectionStatus" VARCHAR(32) NOT NULL DEFAULT 'inactive',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_POSDevice_connectionStatus"
    CHECK ("connectionStatus" IN ('inactive', 'active', 'error'))
);

CREATE INDEX IF NOT EXISTS "IDX_POSDevice_tenantId" ON "POSDevice" ("tenantId");

CREATE TABLE IF NOT EXISTS "PrinterDevice" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "TenantAccount"("id") ON DELETE CASCADE,
  "storeId" UUID REFERENCES "Store"("id") ON DELETE CASCADE,
  "deviceName" VARCHAR(160) NOT NULL,
  "printerRole" VARCHAR(32) NOT NULL DEFAULT 'receipt',
  "connectionType" VARCHAR(32) NOT NULL DEFAULT 'network',
  "connectionStatus" VARCHAR(32) NOT NULL DEFAULT 'inactive',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_PrinterDevice_printerRole"
    CHECK ("printerRole" IN ('receipt', 'kitchen', 'label')),
  CONSTRAINT "CHK_PrinterDevice_connectionType"
    CHECK ("connectionType" IN ('network', 'usb', 'bluetooth')),
  CONSTRAINT "CHK_PrinterDevice_connectionStatus"
    CHECK ("connectionStatus" IN ('inactive', 'active', 'error'))
);

CREATE INDEX IF NOT EXISTS "IDX_PrinterDevice_tenantId" ON "PrinterDevice" ("tenantId");

CREATE TABLE IF NOT EXISTS "ScaleDevice" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "TenantAccount"("id") ON DELETE CASCADE,
  "storeId" UUID REFERENCES "Store"("id") ON DELETE CASCADE,
  "deviceName" VARCHAR(160) NOT NULL,
  "connectionStatus" VARCHAR(32) NOT NULL DEFAULT 'inactive',
  "weightUnit" VARCHAR(16) NOT NULL DEFAULT 'gram',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_ScaleDevice_connectionStatus"
    CHECK ("connectionStatus" IN ('inactive', 'active', 'error')),
  CONSTRAINT "CHK_ScaleDevice_weightUnit"
    CHECK ("weightUnit" IN ('gram', 'kilogram'))
);

CREATE INDEX IF NOT EXISTS "IDX_ScaleDevice_tenantId" ON "ScaleDevice" ("tenantId");
