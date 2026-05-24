-- Migration 0025: Tenant onboarding V2 plan selection persistence.

CREATE TABLE IF NOT EXISTS "TenantOnboardingPlanSelection" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL UNIQUE,
  "planKey" TEXT NOT NULL,
  "planNameSnapshot" TEXT NOT NULL,
  "commissionSummarySnapshot" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "selectedAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOnboardingPlanSelection_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE
);

INSERT INTO "TenantOnboardingStepProgress" (
  "id", "applicationId", "stepKey", "status", "completedAt", "blockedReason", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  app."id",
  'membership_plan',
  'not_started',
  NULL,
  NULL,
  NOW(),
  NOW()
FROM "TenantOnboardingApplication" app
ON CONFLICT ("applicationId", "stepKey") DO NOTHING;
