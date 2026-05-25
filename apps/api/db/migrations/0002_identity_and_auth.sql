-- 0002 — Identity and auth.
--
-- Three identity tables — CustomerAccount, TenantAccount, AdminAccount —
-- plus a shared RefreshSession ledger and CustomerSocialAccount for OAuth
-- providers. TenantAccount keeps its current shape (identity + business
-- columns); the identity/business split is scheduled for MR-ARCH-02.

-- ===========================================================================
-- Customer identity
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "CustomerAccount" (
  "id" UUID NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "passwordHash" TEXT,
  "loginPreference" BOOLEAN NOT NULL DEFAULT FALSE,
  "phoneNumber" TEXT,
  "birthDate" TIMESTAMPTZ,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "CustomerSocialAccount" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "providerEmail" TEXT,
  "profileFirstName" TEXT,
  "profileLastName" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CustomerSocialAccount_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSocialAccount_provider_providerAccountId_key"
  ON "CustomerSocialAccount" ("provider", "providerAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSocialAccount_customerAccountId_provider_key"
  ON "CustomerSocialAccount" ("customerAccountId", "provider");
CREATE INDEX IF NOT EXISTS "CustomerSocialAccount_customerAccountId_idx"
  ON "CustomerSocialAccount" ("customerAccountId");

-- ===========================================================================
-- Tenant identity (kept with business columns until MR-ARCH-02)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "TenantAccount" (
  "id" UUID NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "companyAddress" TEXT NOT NULL,
  "tenantType" TEXT NOT NULL,
  "deliveryModel" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL,
  "onboardingStatus" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

-- ===========================================================================
-- Admin identity
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "AdminAccount" (
  "id" UUID NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

-- ===========================================================================
-- Shared refresh-session ledger (one row per device per subject)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "RefreshSession" (
  "id" UUID NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "subjectType" TEXT NOT NULL,
  "customerAccountId" UUID,
  "tenantAccountId" UUID,
  "adminAccountId" UUID,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "isRevoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  CONSTRAINT "RefreshSession_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "RefreshSession_tenantAccountId_fkey"
    FOREIGN KEY ("tenantAccountId") REFERENCES "TenantAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "RefreshSession_adminAccountId_fkey"
    FOREIGN KEY ("adminAccountId") REFERENCES "AdminAccount" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_customerAccountId_idx"
  ON "RefreshSession" ("subjectType", "customerAccountId");
CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_tenantAccountId_idx"
  ON "RefreshSession" ("subjectType", "tenantAccountId");
CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_adminAccountId_idx"
  ON "RefreshSession" ("subjectType", "adminAccountId");
