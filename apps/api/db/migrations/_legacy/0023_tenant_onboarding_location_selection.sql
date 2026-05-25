-- Migration 0023: Persist the V2 location-search step separately from full address fields.

CREATE TABLE IF NOT EXISTS "TenantOnboardingLocationSelection" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL UNIQUE,
  "locationLabel" TEXT NOT NULL,
  "rawInput" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'CH',
  "city" TEXT,
  "postalCode" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOnboardingLocationSelection_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE
);
