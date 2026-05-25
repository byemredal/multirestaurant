-- 0006 — Tenant onboarding (Application + step state + sub-detail tables).
--
-- This is the V2 onboarding model. Notes:
--   • TenantOnboardingApplication carries `tokenSalt` (used to build encrypted
--     URL state tokens). The legacy `stateToken` column from the original
--     0021 fix migration is GONE from this baseline — there is nothing to
--     drop, because the column never existed in a fresh install.
--   • Step progress is sourced from a fixed key set; child detail tables are
--     one-to-one with the application (except TenantDocument, which is many).
--   • FileAsset is the shared upload record. AdminNote / AuditLog support
--     admin oversight.

-- ===========================================================================
-- FileAsset — shared upload registry
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "FileAsset" (
  "id" UUID NOT NULL PRIMARY KEY,
  "ownerTenantId" UUID,
  "storageKey" TEXT NOT NULL UNIQUE,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "uploadedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "FileAsset_ownerTenantId_fkey"
    FOREIGN KEY ("ownerTenantId") REFERENCES "TenantAccount" ("id") ON DELETE SET NULL
);

-- ===========================================================================
-- Onboarding application + step progress
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "TenantOnboardingApplication" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantAccountId" UUID NOT NULL UNIQUE,
  "status" TEXT NOT NULL,
  "submittedAt" TIMESTAMPTZ,
  "reviewStartedAt" TIMESTAMPTZ,
  "approvedAt" TIMESTAMPTZ,
  "rejectedAt" TIMESTAMPTZ,
  "revisionRequestedAt" TIMESTAMPTZ,
  "activatedAt" TIMESTAMPTZ,
  "suspendedAt" TIMESTAMPTZ,
  "lastSubmittedAt" TIMESTAMPTZ,
  "currentRevisionNumber" INTEGER NOT NULL DEFAULT 0,
  -- The encrypted URL state token is computed at request time using this salt.
  -- The legacy persisted `stateToken` column is intentionally absent.
  "tokenSalt" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOnboardingApplication_tenantAccountId_fkey"
    FOREIGN KEY ("tenantAccountId") REFERENCES "TenantAccount" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TenantOnboardingApplication_status_idx"
  ON "TenantOnboardingApplication" ("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "TenantOnboardingStepProgress" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL,
  "stepKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "completedAt" TIMESTAMPTZ,
  "blockedReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOnboardingStepProgress_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE,
  CONSTRAINT "TenantOnboardingStepProgress_applicationId_stepKey_key"
    UNIQUE ("applicationId", "stepKey")
);

-- ===========================================================================
-- One-to-one detail tables
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "TenantBusinessDetail" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL UNIQUE,
  "businessName" TEXT NOT NULL,
  "businessType" TEXT NOT NULL,
  "registrationNumber" TEXT,
  "taxNumber" TEXT,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantBusinessDetail_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TenantBusinessDetail_city_businessType_idx"
  ON "TenantBusinessDetail" ("city", "businessType");

CREATE TABLE IF NOT EXISTS "TenantLegalDetail" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL UNIQUE,
  "legalEntityName" TEXT NOT NULL,
  "taxId" TEXT,
  "vatId" TEXT,
  "registrationCountry" TEXT NOT NULL,
  "registeredAddress" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantLegalDetail_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "TenantOwnerContact" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL UNIQUE,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "roleTitle" TEXT,
  "ownershipPercentage" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOwnerContact_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "TenantOperationsProfile" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL UNIQUE,
  "primaryCity" TEXT NOT NULL,
  "primaryPostalCode" TEXT NOT NULL,
  "deliveryModel" TEXT NOT NULL,
  "supportsPickup" BOOLEAN NOT NULL DEFAULT FALSE,
  "openingHoursSummary" TEXT,
  "estimatedGoLiveDate" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantOperationsProfile_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE
);

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

-- ===========================================================================
-- Documents + reviews
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "TenantDocument" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL,
  "fileAssetId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isCurrent" BOOLEAN NOT NULL DEFAULT TRUE,
  "uploadedAt" TIMESTAMPTZ NOT NULL,
  "reviewedAt" TIMESTAMPTZ,
  "reviewedByAdminId" UUID,
  "rejectionReason" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantDocument_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE,
  CONSTRAINT "TenantDocument_fileAssetId_fkey"
    FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset" ("id") ON DELETE CASCADE,
  CONSTRAINT "TenantDocument_reviewedByAdminId_fkey"
    FOREIGN KEY ("reviewedByAdminId") REFERENCES "AdminAccount" ("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "TenantDocument_applicationId_type_current_idx"
  ON "TenantDocument" ("applicationId", "type", "isCurrent");

CREATE TABLE IF NOT EXISTS "TenantDocumentReview" (
  "id" UUID NOT NULL PRIMARY KEY,
  "documentId" UUID NOT NULL,
  "adminId" UUID NOT NULL,
  "decision" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantDocumentReview_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "TenantDocument" ("id") ON DELETE CASCADE,
  CONSTRAINT "TenantDocumentReview_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "AdminAccount" ("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "TenantApplicationReview" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL,
  "adminId" UUID NOT NULL,
  "decision" TEXT NOT NULL,
  "internalNote" TEXT,
  "tenantVisibleNote" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantApplicationReview_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE,
  CONSTRAINT "TenantApplicationReview_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "AdminAccount" ("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "AdminNote" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicationId" UUID NOT NULL,
  "adminId" UUID NOT NULL,
  "scope" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "AdminNote_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE CASCADE,
  CONSTRAINT "AdminNote_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "AdminAccount" ("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" UUID NOT NULL PRIMARY KEY,
  "actorType" TEXT NOT NULL,
  "actorId" UUID,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" UUID NOT NULL,
  "applicationId" UUID,
  "tenantAccountId" UUID,
  "metadataJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "AuditLog_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "TenantOnboardingApplication" ("id") ON DELETE SET NULL,
  CONSTRAINT "AuditLog_tenantAccountId_fkey"
    FOREIGN KEY ("tenantAccountId") REFERENCES "TenantAccount" ("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "AuditLog_applicationId_createdAt_idx"
  ON "AuditLog" ("applicationId", "createdAt");
