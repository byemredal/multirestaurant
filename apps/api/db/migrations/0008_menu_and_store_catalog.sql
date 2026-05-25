-- 0008 — Menu + store catalog.
--
-- The tenant-owned catalog under each Store: menu hierarchy, store-side
-- settings (tax, delivery fees, receipts, reservations, sliders), per-store
-- assignments to system taxonomies (cuisine / payment methods / service
-- types / currency / language), discounts, stamps/loyalty, and reviews.

-- ===========================================================================
-- Menu hierarchy
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "MenuCategory" (
  "id" UUID NOT NULL PRIMARY KEY,
  "storeId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "MenuCategory_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "MenuCategory_storeId_sortOrder_idx"
  ON "MenuCategory" ("storeId", "sortOrder");

CREATE TABLE IF NOT EXISTS "MenuItem" (
  "id" UUID NOT NULL PRIMARY KEY,
  "storeId" UUID NOT NULL,
  "categoryId" UUID,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "basePrice" DOUBLE PRECISION NOT NULL,
  "currencyId" UUID NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "availabilityType" TEXT NOT NULL DEFAULT 'always',
  "imageUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "MenuItem_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
  CONSTRAINT "MenuItem_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "MenuCategory" ("id") ON DELETE SET NULL,
  CONSTRAINT "MenuItem_currencyId_fkey"
    FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "MenuItem_storeId_createdAt_idx"
  ON "MenuItem" ("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "MenuItem_storeId_sortOrder_idx"
  ON "MenuItem" ("storeId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MenuItem_categoryId_idx"
  ON "MenuItem" ("categoryId");

CREATE TABLE IF NOT EXISTS "MenuOptionGroup" (
  "id" UUID NOT NULL PRIMARY KEY,
  "menuItemId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "minSelections" INTEGER NOT NULL DEFAULT 0,
  "maxSelections" INTEGER NOT NULL DEFAULT 1,
  "isRequired" BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "MenuOptionGroup_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "MenuOptionGroup_menuItemId_sortOrder_idx"
  ON "MenuOptionGroup" ("menuItemId", "sortOrder");

CREATE TABLE IF NOT EXISTS "MenuOptionItem" (
  "id" UUID NOT NULL PRIMARY KEY,
  "optionGroupId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "priceDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "MenuOptionItem_optionGroupId_fkey"
    FOREIGN KEY ("optionGroupId") REFERENCES "MenuOptionGroup" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "MenuOptionItem_optionGroupId_sortOrder_idx"
  ON "MenuOptionItem" ("optionGroupId", "sortOrder");

-- ===========================================================================
-- Per-store assignments to system taxonomies
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "StoreCuisine" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "cuisineId" UUID NOT NULL REFERENCES "Cuisine"("id") ON DELETE CASCADE,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_StoreCuisine_store_cuisine"
    UNIQUE ("storeId", "cuisineId")
);

CREATE INDEX IF NOT EXISTS "IDX_StoreCuisine_storeId" ON "StoreCuisine" ("storeId");
CREATE INDEX IF NOT EXISTS "IDX_StoreCuisine_cuisineId" ON "StoreCuisine" ("cuisineId");
-- A store can only have one primary cuisine.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_StoreCuisine_store_primary"
  ON "StoreCuisine" ("storeId") WHERE "isPrimary" = TRUE;

CREATE TABLE IF NOT EXISTS "StorePaymentMethod" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "paymentMethodId" UUID NOT NULL REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT,
  "customLabel" VARCHAR(120),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_StorePaymentMethod_store_paymentMethod"
    UNIQUE ("storeId", "paymentMethodId")
);

CREATE INDEX IF NOT EXISTS "IDX_StorePaymentMethod_storeId"
  ON "StorePaymentMethod" ("storeId");

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

CREATE INDEX IF NOT EXISTS "IDX_StoreCurrency_storeId" ON "StoreCurrency" ("storeId");

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

CREATE INDEX IF NOT EXISTS "IDX_StoreLanguage_storeId" ON "StoreLanguage" ("storeId");

-- ===========================================================================
-- Per-store operational settings
-- ===========================================================================

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

CREATE TABLE IF NOT EXISTS "StoreOrderingPolicy" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL UNIQUE REFERENCES "Store"("id") ON DELETE CASCADE,
  "minOrderAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "acceptsDelivery" BOOLEAN NOT NULL DEFAULT TRUE,
  "acceptsPickup" BOOLEAN NOT NULL DEFAULT TRUE,
  "currencyCode" VARCHAR(8) NOT NULL DEFAULT 'TRY',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StoreOrderingPolicy_minOrderAmount"
    CHECK ("minOrderAmount" >= 0),
  CONSTRAINT "CHK_StoreOrderingPolicy_atLeastOneService"
    CHECK ("acceptsDelivery" = TRUE OR "acceptsPickup" = TRUE)
);

CREATE TABLE IF NOT EXISTS "StoreDeliveryFeeTier" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "minDistanceKm" NUMERIC(6,2) NOT NULL DEFAULT 0,
  "maxDistanceKm" NUMERIC(6,2) NOT NULL,
  "feeAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StoreDeliveryFeeTier_distance"
    CHECK ("minDistanceKm" >= 0 AND "maxDistanceKm" > "minDistanceKm"),
  CONSTRAINT "CHK_StoreDeliveryFeeTier_fee"
    CHECK ("feeAmount" >= 0)
);

CREATE INDEX IF NOT EXISTS "IDX_StoreDeliveryFeeTier_storeId"
  ON "StoreDeliveryFeeTier" ("storeId");

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

CREATE INDEX IF NOT EXISTS "IDX_StoreDiscountRule_storeId"
  ON "StoreDiscountRule" ("storeId");

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

CREATE INDEX IF NOT EXISTS "IDX_StoreSlider_storeId" ON "StoreSlider" ("storeId");

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

CREATE INDEX IF NOT EXISTS "IDX_StoreSliderItem_sliderId" ON "StoreSliderItem" ("sliderId");

-- ===========================================================================
-- Stamp / loyalty (customer ↔ store)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "StoreStampProgram" (
  "id" UUID NOT NULL PRIMARY KEY,
  "storeId" UUID NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "stampsRequired" INTEGER NOT NULL,
  "rewardTitle" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "StoreStampProgram_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "CustomerStampCard" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "stampProgramId" UUID NOT NULL,
  "currentStamps" INTEGER NOT NULL DEFAULT 0,
  "isCompleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CustomerStampCard_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "CustomerStampCard_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
  CONSTRAINT "CustomerStampCard_stampProgramId_fkey"
    FOREIGN KEY ("stampProgramId") REFERENCES "StoreStampProgram" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerStampCard_customerAccountId_storeId_key"
  ON "CustomerStampCard" ("customerAccountId", "storeId");

CREATE TABLE IF NOT EXISTS "CustomerRewardLedger" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL,
  "pointsDelta" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceReferenceId" UUID,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CustomerRewardLedger_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CustomerRewardLedger_customerAccountId_createdAt_idx"
  ON "CustomerRewardLedger" ("customerAccountId", "createdAt" DESC);

-- ===========================================================================
-- Store reviews (must be defined before Order? No — StoreReview FKs Order.
-- We forward-declare here only the cuisine + stamp/loyalty rows; StoreReview
-- itself lives below because it depends on Order (created in 0009).
-- See 0009 for StoreReview, which references Order.id.
-- ===========================================================================
