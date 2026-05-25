-- Migration 0009: Cuisine taxonomy + store reviews.
--   * System-level Cuisine catalog (Kebap, Pizza, etc.)
--   * StoreCuisine: many-to-many between Store and Cuisine
--   * StoreReview: one review per completed order, with tenant reply

CREATE TABLE IF NOT EXISTS "Cuisine" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "emoji" VARCHAR(16),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_Cuisine_active_sortOrder"
  ON "Cuisine" ("isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "StoreCuisine" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "cuisineId" UUID NOT NULL REFERENCES "Cuisine"("id") ON DELETE CASCADE,
  "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_StoreCuisine_store_cuisine"
    UNIQUE ("storeId", "cuisineId")
);

CREATE INDEX IF NOT EXISTS "IDX_StoreCuisine_storeId"
  ON "StoreCuisine" ("storeId");
CREATE INDEX IF NOT EXISTS "IDX_StoreCuisine_cuisineId"
  ON "StoreCuisine" ("cuisineId");
-- A store can only have one primary cuisine.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_StoreCuisine_store_primary"
  ON "StoreCuisine" ("storeId") WHERE "isPrimary" = TRUE;

CREATE TABLE IF NOT EXISTS "StoreReview" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "orderId" UUID NOT NULL UNIQUE REFERENCES "Order"("id") ON DELETE CASCADE,
  "customerAccountId" UUID NOT NULL REFERENCES "CustomerAccount"("id") ON DELETE CASCADE,
  "rating" SMALLINT NOT NULL,
  "title" VARCHAR(160),
  "body" TEXT,
  "status" VARCHAR(24) NOT NULL DEFAULT 'visible',
  "moderationNote" TEXT,
  "flaggedAt" TIMESTAMPTZ,
  "flaggedReason" TEXT,
  "tenantReplyBody" TEXT,
  "tenantReplyAt" TIMESTAMPTZ,
  "tenantReplyByTenantId" UUID REFERENCES "TenantAccount"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StoreReview_rating"
    CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "CHK_StoreReview_status"
    CHECK ("status" IN ('visible', 'hidden', 'flagged', 'deleted'))
);

CREATE INDEX IF NOT EXISTS "IDX_StoreReview_store_status_createdAt"
  ON "StoreReview" ("storeId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_StoreReview_customerAccountId"
  ON "StoreReview" ("customerAccountId");
-- Supports rating aggregation over visible reviews per store.
CREATE INDEX IF NOT EXISTS "IDX_StoreReview_store_visible_rating"
  ON "StoreReview" ("storeId") WHERE "status" = 'visible';

-- Baseline cuisine catalog. Slugs are stable identifiers; names are display-only.
INSERT INTO "Cuisine" ("slug", "name", "emoji", "sortOrder") VALUES
  ('kebap',           'Kebap',                    '🍢',  10),
  ('pizza',           'Pizza',                    '🍕',  20),
  ('burger',          'Burger',                   '🍔',  30),
  ('italyan-mutfagi', 'İtalyan Mutfağı',          '🍝',  40),
  ('cin-mutfagi',     'Çin Mutfağı',              '🥡',  50),
  ('balik-deniz',     'Balık & Deniz Ürünleri',   '🐟',  60),
  ('turk-mutfagi',    'Türk Mutfağı',             '🥘',  70),
  ('ev-yemekleri',    'Ev Yemekleri',             '🍲',  80),
  ('kahvalti',        'Kahvaltı',                 '🍳',  90),
  ('tatli',           'Tatlı',                    '🍰', 100),
  ('kafe-icecekler',  'Kafe & İçecekler',         '☕', 110),
  ('vegan',           'Vegan',                    '🥗', 120),
  ('meksika',         'Meksika Mutfağı',          '🌮', 130),
  ('uzak-dogu',       'Uzak Doğu (Suşi, Noodle)', '🍱', 140)
ON CONFLICT ("slug") DO NOTHING;
