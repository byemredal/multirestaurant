-- Migration 0001: PostgreSQL foundation.
-- System catalog (currency / language / payment / service taxonomy), account
-- tables, and the core operational schema: Store (a full operational
-- location), menu, cart and order.

CREATE TABLE IF NOT EXISTS "schema_migrations" (
  "id" TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  ('TRY', 'Turkish Lira',          '₺', '949', 2, 10),
  ('EUR', 'Euro',                  '€', '978', 2, 20),
  ('USD', 'United States Dollar',  '$', '840', 2, 30),
  ('GBP', 'Pound Sterling',        '£', '826', 2, 40)
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
  ('de-DE', 'German (Germany)',  'Deutsch',  30)
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
-- Accounts
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "CustomerAccount" (
  "id" UUID NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "passwordHash" TEXT,
  "loginPreference" BOOLEAN NOT NULL DEFAULT FALSE,
  "phoneNumber" TEXT,
  "birthDate" TIMESTAMPTZ,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "TenantAccount" (
  "id" UUID NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "companyAddress" TEXT NOT NULL,
  "tenantType" TEXT NOT NULL,
  "deliveryModel" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL,
  "onboardingStatus" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "AdminAccount" (
  "id" UUID NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "RefreshSession" (
  "id" UUID NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "subjectType" TEXT NOT NULL,
  "customerAccountId" UUID,
  "tenantAccountId" UUID,
  "adminAccountId" UUID,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "isRevoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  CONSTRAINT "RefreshSession_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "RefreshSession_tenantAccountId_fkey"
    FOREIGN KEY ("tenantAccountId") REFERENCES "TenantAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "RefreshSession_adminAccountId_fkey"
    FOREIGN KEY ("adminAccountId") REFERENCES "AdminAccount" ("id") ON DELETE CASCADE
);

-- ===========================================================================
-- Store — a full operational location
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
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Store_ownerTenantId_fkey"
    FOREIGN KEY ("ownerTenantId") REFERENCES "TenantAccount" ("id") ON DELETE CASCADE
);

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

-- ===========================================================================
-- Menu
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

-- ===========================================================================
-- Cart
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Cart" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL UNIQUE,
  "storeId" UUID NOT NULL,
  "subtotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currencyId" UUID,
  "currencySnapshot" TEXT NOT NULL,
  "serviceTypeId" UUID,
  "serviceTypeSnapshot" VARCHAR(40) NOT NULL,
  "paymentMethodId" UUID,
  "paymentMethodSnapshot" VARCHAR(40),
  "deliveryDistanceKm" NUMERIC(6,2),
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Cart_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "Cart_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
  CONSTRAINT "Cart_currencyId_fkey"
    FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE SET NULL,
  CONSTRAINT "Cart_serviceTypeId_fkey"
    FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType" ("id") ON DELETE SET NULL,
  CONSTRAINT "Cart_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "CartItem" (
  "id" UUID NOT NULL PRIMARY KEY,
  "cartId" UUID NOT NULL,
  "menuItemId" UUID NOT NULL,
  "itemNameSnapshot" TEXT NOT NULL,
  "unitBasePriceSnapshot" DOUBLE PRECISION NOT NULL,
  "currencySnapshot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lineBaseTotal" DOUBLE PRECISION NOT NULL,
  "lineOptionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lineTotal" DOUBLE PRECISION NOT NULL,
  "selectionSignature" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CartItem_cartId_fkey"
    FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE CASCADE,
  CONSTRAINT "CartItem_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT,
  CONSTRAINT "CartItem_cartId_menuItemId_selectionSignature_key"
    UNIQUE ("cartId", "menuItemId", "selectionSignature")
);

CREATE TABLE IF NOT EXISTS "CartItemOptionSelection" (
  "id" UUID NOT NULL PRIMARY KEY,
  "cartItemId" UUID NOT NULL,
  "optionGroupId" UUID NOT NULL,
  "optionItemId" UUID NOT NULL,
  "optionGroupNameSnapshot" TEXT NOT NULL,
  "optionItemNameSnapshot" TEXT NOT NULL,
  "optionPriceDeltaSnapshot" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CartItemOptionSelection_cartItemId_fkey"
    FOREIGN KEY ("cartItemId") REFERENCES "CartItem" ("id") ON DELETE CASCADE,
  CONSTRAINT "CartItemOptionSelection_optionGroupId_fkey"
    FOREIGN KEY ("optionGroupId") REFERENCES "MenuOptionGroup" ("id") ON DELETE RESTRICT,
  CONSTRAINT "CartItemOptionSelection_optionItemId_fkey"
    FOREIGN KEY ("optionItemId") REFERENCES "MenuOptionItem" ("id") ON DELETE RESTRICT
);

-- ===========================================================================
-- Order
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Order" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "rejectedReason" TEXT,
  "statusNote" TEXT,
  "lastStatusChangedAt" TIMESTAMPTZ,
  "lastStatusChangedByType" TEXT,
  "subtotalAmount" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "currencyId" UUID,
  "currencySnapshot" TEXT NOT NULL,
  "serviceTypeId" UUID,
  "serviceTypeSnapshot" VARCHAR(40) NOT NULL,
  "paymentMethodId" UUID,
  "paymentMethodSnapshot" VARCHAR(40),
  "deliveryFeeAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "deliveryDistanceKm" NUMERIC(6,2),
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Order_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE RESTRICT,
  CONSTRAINT "Order_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT,
  CONSTRAINT "Order_currencyId_fkey"
    FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE SET NULL,
  CONSTRAINT "Order_serviceTypeId_fkey"
    FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType" ("id") ON DELETE SET NULL,
  CONSTRAINT "Order_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" UUID NOT NULL PRIMARY KEY,
  "orderId" UUID NOT NULL,
  "menuItemId" UUID NOT NULL,
  "itemNameSnapshot" TEXT NOT NULL,
  "unitBasePriceSnapshot" DOUBLE PRECISION NOT NULL,
  "currencySnapshot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lineBaseTotal" DOUBLE PRECISION NOT NULL,
  "lineOptionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lineTotal" DOUBLE PRECISION NOT NULL,
  "selectionSignature" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE,
  CONSTRAINT "OrderItem_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "OrderItemOptionSelection" (
  "id" UUID NOT NULL PRIMARY KEY,
  "orderItemId" UUID NOT NULL,
  "optionGroupId" UUID NOT NULL,
  "optionItemId" UUID NOT NULL,
  "optionGroupNameSnapshot" TEXT NOT NULL,
  "optionItemNameSnapshot" TEXT NOT NULL,
  "optionPriceDeltaSnapshot" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "OrderItemOptionSelection_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE,
  CONSTRAINT "OrderItemOptionSelection_optionGroupId_fkey"
    FOREIGN KEY ("optionGroupId") REFERENCES "MenuOptionGroup" ("id") ON DELETE RESTRICT,
  CONSTRAINT "OrderItemOptionSelection_optionItemId_fkey"
    FOREIGN KEY ("optionItemId") REFERENCES "MenuOptionItem" ("id") ON DELETE RESTRICT
);

-- ===========================================================================
-- Indexes
-- ===========================================================================

CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_customerAccountId_idx"
  ON "RefreshSession" ("subjectType", "customerAccountId");
CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_tenantAccountId_idx"
  ON "RefreshSession" ("subjectType", "tenantAccountId");
CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_adminAccountId_idx"
  ON "RefreshSession" ("subjectType", "adminAccountId");
CREATE INDEX IF NOT EXISTS "Store_ownerTenantId_createdAt_idx"
  ON "Store" ("ownerTenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "StoreOpeningHour_storeId_dayOfWeek_idx"
  ON "StoreOpeningHour" ("storeId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "StoreDeliveryZone_storeId_idx"
  ON "StoreDeliveryZone" ("storeId");
CREATE INDEX IF NOT EXISTS "MenuCategory_storeId_sortOrder_idx"
  ON "MenuCategory" ("storeId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MenuItem_storeId_createdAt_idx"
  ON "MenuItem" ("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "MenuItem_storeId_sortOrder_idx"
  ON "MenuItem" ("storeId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MenuItem_categoryId_idx"
  ON "MenuItem" ("categoryId");
CREATE INDEX IF NOT EXISTS "MenuOptionGroup_menuItemId_sortOrder_idx"
  ON "MenuOptionGroup" ("menuItemId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MenuOptionItem_optionGroupId_sortOrder_idx"
  ON "MenuOptionItem" ("optionGroupId", "sortOrder");
CREATE INDEX IF NOT EXISTS "Cart_storeId_idx"
  ON "Cart" ("storeId");
CREATE INDEX IF NOT EXISTS "CartItem_cartId_createdAt_idx"
  ON "CartItem" ("cartId", "createdAt");
CREATE INDEX IF NOT EXISTS "CartItem_menuItemId_idx"
  ON "CartItem" ("menuItemId");
CREATE INDEX IF NOT EXISTS "CartItemOptionSelection_cartItemId_idx"
  ON "CartItemOptionSelection" ("cartItemId");
CREATE INDEX IF NOT EXISTS "CartItemOptionSelection_optionGroupId_idx"
  ON "CartItemOptionSelection" ("optionGroupId");
CREATE INDEX IF NOT EXISTS "CartItemOptionSelection_optionItemId_idx"
  ON "CartItemOptionSelection" ("optionItemId");
CREATE INDEX IF NOT EXISTS "Order_customerAccountId_createdAt_idx"
  ON "Order" ("customerAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_storeId_createdAt_idx"
  ON "Order" ("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_storeId_status_createdAt_idx"
  ON "Order" ("storeId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_createdAt_idx"
  ON "OrderItem" ("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_menuItemId_idx"
  ON "OrderItem" ("menuItemId");
CREATE INDEX IF NOT EXISTS "OrderItemOptionSelection_orderItemId_idx"
  ON "OrderItemOptionSelection" ("orderItemId");
CREATE INDEX IF NOT EXISTS "OrderItemOptionSelection_optionGroupId_idx"
  ON "OrderItemOptionSelection" ("optionGroupId");
CREATE INDEX IF NOT EXISTS "OrderItemOptionSelection_optionItemId_idx"
  ON "OrderItemOptionSelection" ("optionItemId");
