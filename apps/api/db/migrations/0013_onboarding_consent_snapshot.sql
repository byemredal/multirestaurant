-- 0013 - Onboarding consent snapshots.
--
-- Stores the wording/version accepted during state-token onboarding so later
-- country-pack/legal-copy changes do not rewrite historical acknowledgements.

CREATE TABLE IF NOT EXISTS "TenantOnboardingConsentSnapshot" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL,
  "consentKey" TEXT NOT NULL,
  "consentLabelSnapshot" TEXT NOT NULL,
  "documentCode" TEXT NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "accepted" BOOLEAN NOT NULL DEFAULT TRUE,
  "acceptedAt" TIMESTAMPTZ NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOnboardingConsentSnapshot_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE,
  CONSTRAINT "TenantOnboardingConsentSnapshot_application_key_version_key"
    UNIQUE ("applicationId", "consentKey", "documentVersion")
);

CREATE INDEX IF NOT EXISTS "TenantOnboardingConsentSnapshot_applicationId_idx"
  ON "TenantOnboardingConsentSnapshot" ("applicationId", "acceptedAt");
