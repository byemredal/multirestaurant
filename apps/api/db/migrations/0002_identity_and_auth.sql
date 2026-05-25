-- 0002 — Identity and auth.
--
-- Four identity tables — CustomerAccount, TenantAccount, AdminAccount,
-- StaffAccount — plus the shared RefreshSession ledger and the membership
-- tables that bind those identities to business / store / role contexts.
--
-- TenantAccount holds login identity ONLY. The business / company profile
-- (company name + address, tenant type, delivery model, verification +
-- onboarding status) lives in TenantBusiness, 1:1 with TenantAccount —
-- that split is the MR-ARCH-02 change.

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
-- Tenant identity (login only)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "TenantAccount" (
  "id" UUID NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL
);

-- ===========================================================================
-- Tenant business profile (1:1 with TenantAccount)
-- ===========================================================================
-- Carries the company / verification / onboarding columns that used to live
-- inline on TenantAccount. The 1:1 UNIQUE on tenantAccountId is what makes
-- this a profile rather than a multi-org membership table.

CREATE TABLE IF NOT EXISTS "TenantBusiness" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantAccountId" UUID NOT NULL UNIQUE,
  "companyName" TEXT NOT NULL,
  "companyAddress" TEXT NOT NULL,
  "tenantType" TEXT NOT NULL,
  "deliveryModel" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL,
  "onboardingStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "TenantBusiness_tenantAccountId_fkey"
    FOREIGN KEY ("tenantAccountId") REFERENCES "TenantAccount" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_TenantBusiness_onboardingStatus"
  ON "TenantBusiness" ("onboardingStatus");
CREATE INDEX IF NOT EXISTS "IDX_TenantBusiness_verificationStatus"
  ON "TenantBusiness" ("verificationStatus");

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
-- Staff identity (real login: passwordHash, email NOT NULL, lastLoginAt)
-- ===========================================================================
-- Staff are tenant-scoped login subjects. The runtime auth controller for
-- staff is wired in a follow-up slice; this baseline establishes the
-- identity-grade schema so RefreshSession can reference it.

CREATE TABLE IF NOT EXISTS "StaffAccount" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "TenantAccount"("id") ON DELETE CASCADE,
  "defaultStoreId" UUID,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "fullName" VARCHAR(255) NOT NULL,
  "phoneNumber" VARCHAR(40),
  "passwordHash" TEXT,
  "staffType" VARCHAR(32) NOT NULL,
  "employmentStatus" VARCHAR(32) NOT NULL DEFAULT 'active',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "lastLoginAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StaffAccount_staffType"
    CHECK ("staffType" IN ('cashier', 'delivery_admin', 'kitchen', 'manager', 'host', 'other')),
  CONSTRAINT "CHK_StaffAccount_employmentStatus"
    CHECK ("employmentStatus" IN ('active', 'invited', 'suspended'))
  -- defaultStoreId FK declared in 0003 (after Store is created).
);

CREATE INDEX IF NOT EXISTS "IDX_StaffAccount_tenantId" ON "StaffAccount" ("tenantId");

-- ===========================================================================
-- Memberships — bind identities to business / scope / role contexts
-- ===========================================================================
-- AdminMembership : platform admin roles + optional structured scope JSON
--                   (a single admin may carry several scoped roles).
-- TenantMembership : owners / co-owners / accountants tied to a tenant
--                    business; MVP creates exactly one OWNER row per signup.
-- StaffMembership  : staff ↔ store assignments. A staff person may work at
--                    multiple stores within the same tenant; created in 0003
--                    because it depends on the Store table.

CREATE TABLE IF NOT EXISTS "AdminMembership" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "adminAccountId" UUID NOT NULL REFERENCES "AdminAccount"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "scope" JSONB,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_AdminMembership_admin_role" UNIQUE ("adminAccountId", "role"),
  CONSTRAINT "CHK_AdminMembership_status"
    CHECK ("status" IN ('active', 'suspended'))
);

CREATE INDEX IF NOT EXISTS "IDX_AdminMembership_status"
  ON "AdminMembership" ("status");

CREATE TABLE IF NOT EXISTS "TenantMembership" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantAccountId" UUID NOT NULL REFERENCES "TenantAccount"("id") ON DELETE CASCADE,
  "tenantBusinessId" UUID NOT NULL REFERENCES "TenantBusiness"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'owner',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_TenantMembership_account_business"
    UNIQUE ("tenantAccountId", "tenantBusinessId"),
  CONSTRAINT "CHK_TenantMembership_role"
    CHECK ("role" IN ('owner', 'co_owner', 'accountant', 'manager')),
  CONSTRAINT "CHK_TenantMembership_status"
    CHECK ("status" IN ('active', 'suspended'))
);

CREATE INDEX IF NOT EXISTS "IDX_TenantMembership_business_status"
  ON "TenantMembership" ("tenantBusinessId", "status");

-- ===========================================================================
-- Shared refresh-session ledger (one row per device per subject)
-- ===========================================================================
-- subjectType discriminates customer / tenant / staff / admin. RefreshSession
-- has exactly one non-null subject FK per row (XOR), enforced by the CHECK
-- below. This is what stops a refresh token issued for one surface from being
-- silently reused on another.

CREATE TABLE IF NOT EXISTS "RefreshSession" (
  "id" UUID NOT NULL PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "subjectType" TEXT NOT NULL,
  "customerAccountId" UUID,
  "tenantAccountId" UUID,
  "staffAccountId" UUID,
  "adminAccountId" UUID,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "isRevoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  CONSTRAINT "RefreshSession_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "RefreshSession_tenantAccountId_fkey"
    FOREIGN KEY ("tenantAccountId") REFERENCES "TenantAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "RefreshSession_staffAccountId_fkey"
    FOREIGN KEY ("staffAccountId") REFERENCES "StaffAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "RefreshSession_adminAccountId_fkey"
    FOREIGN KEY ("adminAccountId") REFERENCES "AdminAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "CHK_RefreshSession_subjectType"
    CHECK ("subjectType" IN ('customer', 'tenant', 'staff', 'admin')),
  -- Exactly one subject FK is set, matching subjectType. This is the
  -- structural guarantee that a refresh token cannot cross surfaces.
  CONSTRAINT "CHK_RefreshSession_subjectXor" CHECK (
    ("subjectType" = 'customer'
       AND "customerAccountId" IS NOT NULL
       AND "tenantAccountId" IS NULL AND "staffAccountId" IS NULL AND "adminAccountId" IS NULL)
    OR
    ("subjectType" = 'tenant'
       AND "tenantAccountId" IS NOT NULL
       AND "customerAccountId" IS NULL AND "staffAccountId" IS NULL AND "adminAccountId" IS NULL)
    OR
    ("subjectType" = 'staff'
       AND "staffAccountId" IS NOT NULL
       AND "customerAccountId" IS NULL AND "tenantAccountId" IS NULL AND "adminAccountId" IS NULL)
    OR
    ("subjectType" = 'admin'
       AND "adminAccountId" IS NOT NULL
       AND "customerAccountId" IS NULL AND "tenantAccountId" IS NULL AND "staffAccountId" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_customerAccountId_idx"
  ON "RefreshSession" ("subjectType", "customerAccountId");
CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_tenantAccountId_idx"
  ON "RefreshSession" ("subjectType", "tenantAccountId");
CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_staffAccountId_idx"
  ON "RefreshSession" ("subjectType", "staffAccountId");
CREATE INDEX IF NOT EXISTS "RefreshSession_subjectType_adminAccountId_idx"
  ON "RefreshSession" ("subjectType", "adminAccountId");
