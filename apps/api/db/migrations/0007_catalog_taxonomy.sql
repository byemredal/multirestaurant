-- 0007 — Platform-level catalog taxonomy (admin-owned).
--
-- Cuisines are platform-wide reference data referenced by stores. Per
-- ADR-architecture-reset-track, additional taxonomies (dietary tags,
-- allergens, marketplace categories) belong here too — they are deferred to
-- MR-ARCH-06 (catalog UX) and will be added in their own follow-up file
-- rather than expanding this baseline pre-emptively.

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

-- Baseline cuisine catalog (slugs are stable identifiers).
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
