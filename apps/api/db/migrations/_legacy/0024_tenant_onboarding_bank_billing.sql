-- Migration 0024: Tenant onboarding V2 bank and billing persistence.

CREATE TABLE IF NOT EXISTS "TenantOnboardingBankDetail" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL UNIQUE,
  "bankName" TEXT NOT NULL,
  "accountHolderName" TEXT NOT NULL,
  "iban" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOnboardingBankDetail_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "TenantOnboardingBillingAddress" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL UNIQUE,
  "useBusinessAddress" BOOLEAN NOT NULL DEFAULT FALSE,
  "billingName" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOnboardingBillingAddress_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE
);

INSERT INTO "TenantOnboardingStepProgress" (
  "id", "applicationId", "stepKey", "status", "completedAt", "blockedReason", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  app."id",
  step_key,
  'not_started',
  NULL,
  NULL,
  NOW(),
  NOW()
FROM "TenantOnboardingApplication" app
CROSS JOIN (VALUES ('bank_details'), ('billing_address')) AS steps(step_key)
ON CONFLICT ("applicationId", "stepKey") DO NOTHING;
