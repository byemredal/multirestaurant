-- Migration 0010: Legal & Consent Domain Foundation
--
-- Implements Phase B of the Architecture Contract:
--   • LegalDocumentType        — system taxonomy (Cuisine pattern)
--   • PlatformLegalDocument    — conceptual document header (platform-owned)
--   • PlatformLegalDocumentVersion — IMMUTABLE versioned content
--   • ConsentEvent             — APPEND-ONLY consent log (customer / tenant / anon)
--   • OrderLegalAcceptance     — IMMUTABLE per-order legal proof
--   • MarketingConsent         — APPEND-ONLY marketing channel consent
--   • StoreTermsAddendum  — store-scoped add-on terms
--
-- Existing StoreLegalDocument tables (migration 0007) remain readable in
-- this phase. Deprecation/cleanup will be done in a later phase once the new
-- model is fully wired into customer + tenant flows.

-- =====================================================================
-- 1. SYSTEM TAXONOMY: LegalDocumentType
-- =====================================================================
CREATE TABLE IF NOT EXISTS "LegalDocumentType" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "displayName" VARCHAR(160) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_LegalDocumentType_active_sortOrder"
  ON "LegalDocumentType" ("isActive", "sortOrder");

-- Seed baseline document types. 'code' is the stable identifier; 'displayName'
-- can be edited by admin without breaking referential logic.
INSERT INTO "LegalDocumentType" ("code", "displayName", "sortOrder") VALUES
  ('terms_of_service',          'Kullanım Koşulları',                10),
  ('privacy_policy',            'Gizlilik Politikası',               20),
  ('kvkk_disclosure',           'KVKK Aydınlatma Metni',             30),
  ('cookie_policy',             'Çerez Politikası',                  40),
  ('distance_sales_contract',   'Mesafeli Satış Sözleşmesi',         50),
  ('pre_information_form',      'Ön Bilgilendirme Formu',            60),
  ('tenant_service_agreement', 'Tenant Hizmet Sözleşmesi',         70),
  ('commission_tariff',         'Komisyon Tarifesi',                 80)
ON CONFLICT ("code") DO NOTHING;

-- =====================================================================
-- 2. PlatformLegalDocument — conceptual header (platform-owned)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "PlatformLegalDocument" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "typeId" UUID NOT NULL REFERENCES "LegalDocumentType"("id") ON DELETE RESTRICT,
  "code" VARCHAR(120) NOT NULL UNIQUE,
  "audience" VARCHAR(20) NOT NULL DEFAULT 'customer',
  "isRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_PlatformLegalDocument_audience"
    CHECK ("audience" IN ('customer', 'tenant', 'all'))
);

CREATE INDEX IF NOT EXISTS "IDX_PlatformLegalDocument_audience_active"
  ON "PlatformLegalDocument" ("audience", "isActive");
CREATE INDEX IF NOT EXISTS "IDX_PlatformLegalDocument_typeId"
  ON "PlatformLegalDocument" ("typeId");

-- =====================================================================
-- 3. PlatformLegalDocumentVersion — IMMUTABLE versioned content
-- =====================================================================
CREATE TABLE IF NOT EXISTS "PlatformLegalDocumentVersion" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "documentId" UUID NOT NULL REFERENCES "PlatformLegalDocument"("id") ON DELETE RESTRICT,
  "versionLabel" VARCHAR(64) NOT NULL,
  "locale" VARCHAR(16) NOT NULL DEFAULT 'tr',
  "title" VARCHAR(255) NOT NULL,
  "body" TEXT NOT NULL,
  "bodyFormat" VARCHAR(20) NOT NULL DEFAULT 'markdown',
  "contentHashSha256" VARCHAR(64) NOT NULL,
  "effectiveFrom" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "supersededAt" TIMESTAMPTZ,
  "createdByAdminId" UUID REFERENCES "AdminAccount"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_PlatformLegalDocumentVersion_bodyFormat"
    CHECK ("bodyFormat" IN ('markdown', 'html', 'plain_text')),
  CONSTRAINT "UQ_PlatformLegalDocumentVersion_doc_label_locale"
    UNIQUE ("documentId", "versionLabel", "locale")
);

CREATE INDEX IF NOT EXISTS "IDX_PlatformLegalDocumentVersion_doc_publishedAt"
  ON "PlatformLegalDocumentVersion" ("documentId", "publishedAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_PlatformLegalDocumentVersion_doc_locale"
  ON "PlatformLegalDocumentVersion" ("documentId", "locale");
-- Partial index for "current" version lookups (supersededAt IS NULL).
CREATE INDEX IF NOT EXISTS "IDX_PlatformLegalDocumentVersion_current"
  ON "PlatformLegalDocumentVersion" ("documentId", "locale")
  WHERE "supersededAt" IS NULL;

-- =====================================================================
-- 4. ConsentEvent — APPEND-ONLY consent log
-- =====================================================================
CREATE TABLE IF NOT EXISTS "ConsentEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "subjectType" VARCHAR(20) NOT NULL,
  "customerAccountId" UUID REFERENCES "CustomerAccount"("id") ON DELETE SET NULL,
  "tenantAccountId" UUID REFERENCES "TenantAccount"("id") ON DELETE SET NULL,
  "anonymousIdentifier" VARCHAR(120),
  "documentVersionId" UUID NOT NULL REFERENCES "PlatformLegalDocumentVersion"("id") ON DELETE RESTRICT,
  "action" VARCHAR(20) NOT NULL,
  "ipAddress" INET,
  "userAgent" VARCHAR(500),
  "channel" VARCHAR(30) NOT NULL,
  "contextRef" VARCHAR(160),
  "acceptedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_ConsentEvent_subjectType"
    CHECK ("subjectType" IN ('customer', 'tenant', 'anonymous')),
  CONSTRAINT "CHK_ConsentEvent_action"
    CHECK ("action" IN ('granted', 'revoked', 'renewed')),
  CONSTRAINT "CHK_ConsentEvent_channel"
    CHECK ("channel" IN ('web', 'ios', 'android', 'tenant-portal', 'admin-portal', 'in-store', 'api')),
  -- XOR: exactly one subject reference must be set, matching subjectType
  CONSTRAINT "CHK_ConsentEvent_subjectXor"
    CHECK (
      ("subjectType" = 'customer' AND "customerAccountId" IS NOT NULL
        AND "tenantAccountId" IS NULL AND "anonymousIdentifier" IS NULL)
      OR
      ("subjectType" = 'tenant' AND "tenantAccountId" IS NOT NULL
        AND "customerAccountId" IS NULL AND "anonymousIdentifier" IS NULL)
      OR
      ("subjectType" = 'anonymous' AND "anonymousIdentifier" IS NOT NULL
        AND "customerAccountId" IS NULL AND "tenantAccountId" IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS "IDX_ConsentEvent_documentVersionId"
  ON "ConsentEvent" ("documentVersionId");
CREATE INDEX IF NOT EXISTS "IDX_ConsentEvent_customer_acceptedAt"
  ON "ConsentEvent" ("customerAccountId", "acceptedAt" DESC)
  WHERE "customerAccountId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IDX_ConsentEvent_tenant_acceptedAt"
  ON "ConsentEvent" ("tenantAccountId", "acceptedAt" DESC)
  WHERE "tenantAccountId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IDX_ConsentEvent_anonymous_acceptedAt"
  ON "ConsentEvent" ("anonymousIdentifier", "acceptedAt" DESC)
  WHERE "anonymousIdentifier" IS NOT NULL;

-- =====================================================================
-- 5. OrderLegalAcceptance — IMMUTABLE per-order legal proof
-- =====================================================================
CREATE TABLE IF NOT EXISTS "OrderLegalAcceptance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL UNIQUE REFERENCES "Order"("id") ON DELETE CASCADE,
  "distanceSalesContractVersionId" UUID NOT NULL
    REFERENCES "PlatformLegalDocumentVersion"("id") ON DELETE RESTRICT,
  "preInformationFormVersionId" UUID NOT NULL
    REFERENCES "PlatformLegalDocumentVersion"("id") ON DELETE RESTRICT,
  "acceptedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipAddress" INET,
  "userAgent" VARCHAR(500),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_OrderLegalAcceptance_distanceSales"
  ON "OrderLegalAcceptance" ("distanceSalesContractVersionId");
CREATE INDEX IF NOT EXISTS "IDX_OrderLegalAcceptance_preInfoForm"
  ON "OrderLegalAcceptance" ("preInformationFormVersionId");

-- =====================================================================
-- 6. MarketingConsent — APPEND-ONLY marketing channel consent
-- =====================================================================
-- Append-only semantics: each grant/revoke event is a NEW row. Reading the
-- "current state" is achieved by selecting the latest row per
-- (subject, channel) ordered by createdAt DESC.
CREATE TABLE IF NOT EXISTS "MarketingConsent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "subjectType" VARCHAR(20) NOT NULL,
  "customerAccountId" UUID REFERENCES "CustomerAccount"("id") ON DELETE SET NULL,
  "tenantAccountId" UUID REFERENCES "TenantAccount"("id") ON DELETE SET NULL,
  "channel" VARCHAR(20) NOT NULL,
  "action" VARCHAR(20) NOT NULL,
  "source" VARCHAR(120),
  "iysReferenceId" VARCHAR(120),
  "ipAddress" INET,
  "userAgent" VARCHAR(500),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_MarketingConsent_subjectType"
    CHECK ("subjectType" IN ('customer', 'tenant')),
  CONSTRAINT "CHK_MarketingConsent_channel"
    CHECK ("channel" IN ('email', 'sms', 'push', 'call')),
  CONSTRAINT "CHK_MarketingConsent_action"
    CHECK ("action" IN ('granted', 'revoked')),
  CONSTRAINT "CHK_MarketingConsent_subjectXor"
    CHECK (
      ("subjectType" = 'customer' AND "customerAccountId" IS NOT NULL AND "tenantAccountId" IS NULL)
      OR
      ("subjectType" = 'tenant' AND "tenantAccountId" IS NOT NULL AND "customerAccountId" IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS "IDX_MarketingConsent_customer_channel_createdAt"
  ON "MarketingConsent" ("customerAccountId", "channel", "createdAt" DESC)
  WHERE "customerAccountId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IDX_MarketingConsent_tenant_channel_createdAt"
  ON "MarketingConsent" ("tenantAccountId", "channel", "createdAt" DESC)
  WHERE "tenantAccountId" IS NOT NULL;

-- =====================================================================
-- 7. StoreTermsAddendum — store-scoped add-on terms
-- =====================================================================
-- Restoran kendi özel ek terimlerini buraya yazar. PlatformLegalDocument'i
-- override ETMEZ; sadece parent versiyona zincirlenmiş ek metindir.
CREATE TABLE IF NOT EXISTS "StoreTermsAddendum" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "parentDocumentVersionId" UUID NOT NULL
    REFERENCES "PlatformLegalDocumentVersion"("id") ON DELETE RESTRICT,
  "title" VARCHAR(255) NOT NULL,
  "body" TEXT NOT NULL,
  "locale" VARCHAR(16) NOT NULL DEFAULT 'tr',
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_StoreTermsAddendum_storeId"
  ON "StoreTermsAddendum" ("storeId");
CREATE INDEX IF NOT EXISTS "IDX_StoreTermsAddendum_parentVersion"
  ON "StoreTermsAddendum" ("parentDocumentVersionId");
