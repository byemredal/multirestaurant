-- 0017 — Single-use password setup tokens.
--
-- After an admin approves a tenant onboarding application the partner needs
-- to set their initial password. We issue a short-lived, one-shot token that
-- carries the partner from the approved screen / e-mail link into a guarded
-- "set password" form. The token is hashed at rest, expires, and is marked
-- consumed on redeem so replay attempts fail.
--
-- Schema intentionally minimal:
--   * `tenantAccountId` ties the token to its owner.
--   * `purpose` keeps the door open for `password_reset` later without
--     a second table.
--   * `deliveryStatus` records whether the e-mail/SMS actually went out;
--     admin UI can surface "sent / pending / failed" honestly instead of
--     promising delivery the notification layer cannot make.

CREATE TABLE IF NOT EXISTS "TenantPasswordSetupToken" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantAccountId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'initial_password_setup'
    CHECK ("purpose" IN ('initial_password_setup', 'password_reset')),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ,
  "createdByAdminId" UUID,
  "sentToEmail" TEXT,
  "sentToPhone" TEXT,
  "deliveryStatus" TEXT
    CHECK ("deliveryStatus" IS NULL OR "deliveryStatus" IN ('queued', 'sent', 'failed', 'unavailable')),
  "deliveryErrorCode" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "TenantPasswordSetupToken_tenant_fkey"
    FOREIGN KEY ("tenantAccountId") REFERENCES "TenantAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "TenantPasswordSetupToken_admin_fkey"
    FOREIGN KEY ("createdByAdminId") REFERENCES "AdminAccount" ("id") ON DELETE SET NULL,
  CONSTRAINT "TenantPasswordSetupToken_tokenHash_unique" UNIQUE ("tokenHash")
);

CREATE INDEX IF NOT EXISTS "TenantPasswordSetupToken_tenant_active_idx"
  ON "TenantPasswordSetupToken" ("tenantAccountId", "consumedAt", "expiresAt");
