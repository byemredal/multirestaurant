-- Migration 0007: Tenant business management.
-- Platform / tenant / store settings, content, staff and device tables.

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

CREATE TABLE IF NOT EXISTS "StoreSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL UNIQUE REFERENCES "Store"("id") ON DELETE CASCADE,
  "defaultCurrencyId" UUID NOT NULL REFERENCES "Currency"("id") ON DELETE RESTRICT,
  "defaultLanguageId" UUID NOT NULL REFERENCES "Language"("id") ON DELETE RESTRICT,
  "advancedOptionsJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "StoreTaxSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL UNIQUE REFERENCES "Store"("id") ON DELETE CASCADE,
  "taxRegistrationNumber" VARCHAR(80),
  "priceIncludesTax" BOOLEAN NOT NULL DEFAULT TRUE,
  "defaultVatRate" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "serviceChargeRate" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "invoiceFooterText" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "StoreDiscountRule" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "name" VARCHAR(160) NOT NULL,
  "ruleType" VARCHAR(32) NOT NULL,
  "valueType" VARCHAR(24) NOT NULL,
  "valueAmount" NUMERIC(10,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "startsAt" TIMESTAMPTZ,
  "endsAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StoreDiscountRule_ruleType"
    CHECK ("ruleType" IN ('coupon', 'automatic', 'loyalty', 'campaign')),
  CONSTRAINT "CHK_StoreDiscountRule_valueType"
    CHECK ("valueType" IN ('percentage', 'fixed'))
);

CREATE TABLE IF NOT EXISTS "StoreDeliveryFeeSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL UNIQUE REFERENCES "Store"("id") ON DELETE CASCADE,
  "baseFee" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "freeDeliveryThreshold" NUMERIC(10,2),
  "surgeFeeEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "smallOrderFee" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "StoreReceiptSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL UNIQUE REFERENCES "Store"("id") ON DELETE CASCADE,
  "headerText" TEXT,
  "footerText" TEXT,
  "showTaxBreakdown" BOOLEAN NOT NULL DEFAULT TRUE,
  "showQrCode" BOOLEAN NOT NULL DEFAULT FALSE,
  "layoutConfigJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "StoreReservationSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL UNIQUE REFERENCES "Store"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT TRUE,
  "maxPartySize" INTEGER,
  "defaultSlotMinutes" INTEGER NOT NULL DEFAULT 30,
  "leadTimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "StoreContentSetting" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL UNIQUE REFERENCES "Store"("id") ON DELETE CASCADE,
  "defaultLocale" VARCHAR(16) NOT NULL DEFAULT 'tr',
  "socialLinksJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "marketingHeadline" VARCHAR(255),
  "marketingDescription" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "StoreSlider" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "name" VARCHAR(160) NOT NULL,
  "sliderType" VARCHAR(32) NOT NULL DEFAULT 'homepage',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StoreSlider_sliderType"
    CHECK ("sliderType" IN ('homepage', 'campaign', 'seasonal'))
);

CREATE TABLE IF NOT EXISTS "StoreSliderItem" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sliderId" UUID NOT NULL REFERENCES "StoreSlider"("id") ON DELETE CASCADE,
  "imageAssetId" UUID REFERENCES "FileAsset"("id") ON DELETE SET NULL,
  "title" VARCHAR(255),
  "caption" TEXT,
  "targetUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "StoreLegalDocument" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "documentType" VARCHAR(32) NOT NULL,
  "versionLabel" VARCHAR(64) NOT NULL DEFAULT 'v1',
  "isPublished" BOOLEAN NOT NULL DEFAULT FALSE,
  "effectiveFrom" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StoreLegalDocument_documentType"
    CHECK ("documentType" IN ('terms_and_conditions', 'privacy_notice', 'distance_sales'))
);

CREATE TABLE IF NOT EXISTS "StoreLegalDocumentTranslation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL REFERENCES "StoreLegalDocument"("id") ON DELETE CASCADE,
  "locale" VARCHAR(16) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("documentId", "locale")
);

CREATE TABLE IF NOT EXISTS "StoreProfileNote" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "noteType" VARCHAR(32) NOT NULL DEFAULT 'profile',
  "isPublished" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StoreProfileNote_noteType"
    CHECK ("noteType" IN ('profile', 'story', 'operational'))
);

CREATE TABLE IF NOT EXISTS "StoreProfileNoteTranslation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "noteId" UUID NOT NULL REFERENCES "StoreProfileNote"("id") ON DELETE CASCADE,
  "locale" VARCHAR(16) NOT NULL,
  "title" VARCHAR(255),
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("noteId", "locale")
);

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

CREATE INDEX IF NOT EXISTS "IDX_StoreDiscountRule_storeId" ON "StoreDiscountRule" ("storeId");
CREATE INDEX IF NOT EXISTS "IDX_StoreSlider_storeId" ON "StoreSlider" ("storeId");
CREATE INDEX IF NOT EXISTS "IDX_StoreSliderItem_sliderId" ON "StoreSliderItem" ("sliderId");
CREATE INDEX IF NOT EXISTS "IDX_StoreLegalDocument_storeId" ON "StoreLegalDocument" ("storeId");
CREATE INDEX IF NOT EXISTS "IDX_StoreProfileNote_storeId" ON "StoreProfileNote" ("storeId");
CREATE INDEX IF NOT EXISTS "IDX_StaffAccount_tenantId" ON "StaffAccount" ("tenantId");
CREATE INDEX IF NOT EXISTS "IDX_StaffAccount_storeId" ON "StaffAccount" ("storeId");
CREATE INDEX IF NOT EXISTS "IDX_POSDevice_tenantId" ON "POSDevice" ("tenantId");
CREATE INDEX IF NOT EXISTS "IDX_PrinterDevice_tenantId" ON "PrinterDevice" ("tenantId");
CREATE INDEX IF NOT EXISTS "IDX_ScaleDevice_tenantId" ON "ScaleDevice" ("tenantId");
