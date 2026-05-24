-- Migration 0021: Add tokenSalt to the tenant onboarding application and remove persisted stateToken.

ALTER TABLE "TenantOnboardingApplication"
  ADD COLUMN IF NOT EXISTS "tokenSalt" TEXT;

UPDATE "TenantOnboardingApplication"
SET "tokenSalt" = md5(random()::text || clock_timestamp()::text)
WHERE "tokenSalt" IS NULL;

ALTER TABLE "TenantOnboardingApplication"
  DROP COLUMN IF EXISTS "stateToken";
