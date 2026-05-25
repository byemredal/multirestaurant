-- Migration 0008: Commerce foundation.
-- Store-scoped payment method assignments, ordering policy and
-- distance-based delivery fee tiers.

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
