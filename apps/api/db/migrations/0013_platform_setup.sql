-- Migration 0013: Platform bootstrap setup.
-- Single-row table that records the one-time platform initialization
-- performed by the dedicated apps/setup wizard. The CHECK constraint pins
-- the table to one canonical row so the platform can only be set up once.

CREATE TABLE IF NOT EXISTS "PlatformSetup" (
  "id" TEXT PRIMARY KEY DEFAULT 'platform' CHECK ("id" = 'platform'),
  "platformName" VARCHAR(120) NOT NULL,
  "supportEmail" VARCHAR(160) NOT NULL,
  "logoUrl" TEXT,
  "primaryCountry" CHAR(2) NOT NULL,
  "initializedByAdminId" UUID REFERENCES "AdminAccount" ("id") ON DELETE SET NULL,
  "initializedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
