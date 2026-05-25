-- Migration 0022: Persist tenant onboarding phone verification challenges.

CREATE TABLE IF NOT EXISTS "TenantOnboardingPhoneVerification" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL UNIQUE,
  "phoneNumber" TEXT NOT NULL,
  "otpCodeHash" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "verifiedAt" TIMESTAMPTZ,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOnboardingPhoneVerification_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TenantOnboardingPhoneVerification_application_pending_idx"
  ON "TenantOnboardingPhoneVerification" ("applicationId", "expiresAt")
  WHERE "verifiedAt" IS NULL;
