-- 0014 - Setup-managed onboarding compliance catalog foundation.
--
-- Definitions remain placeholder content until reviewed by legal/product.
-- Tenant onboarding reads active records first and keeps a code fallback when
-- no setup-managed entries exist for a country/language pair.

CREATE TABLE IF NOT EXISTS "ComplianceDocumentRequirement" (
  "id" UUID NOT NULL PRIMARY KEY,
  "country" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT FALSE,
  "acceptedFormatsJson" TEXT NOT NULL,
  "guidanceOnly" BOOLEAN NOT NULL DEFAULT TRUE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ComplianceDocumentRequirement_country_language_type_key"
    UNIQUE ("country", "language", "documentType")
);

CREATE INDEX IF NOT EXISTS "ComplianceDocumentRequirement_active_locale_idx"
  ON "ComplianceDocumentRequirement" ("country", "language", "active", "sortOrder");

CREATE TABLE IF NOT EXISTS "ComplianceConsentDefinition" (
  "id" UUID NOT NULL PRIMARY KEY,
  "country" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "consentKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "documentCode" TEXT NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "documentUrl" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT TRUE,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "ComplianceConsentDefinition_locale_key_version_key"
    UNIQUE ("country", "language", "consentKey", "documentVersion")
);

CREATE INDEX IF NOT EXISTS "ComplianceConsentDefinition_active_locale_idx"
  ON "ComplianceConsentDefinition" ("country", "language", "active", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "ComplianceConsentDefinition_one_active_key_idx"
  ON "ComplianceConsentDefinition" ("country", "language", "consentKey")
  WHERE "active" = TRUE;

INSERT INTO "ComplianceDocumentRequirement" (
  "id", "country", "language", "documentType", "label", "description",
  "required", "acceptedFormatsJson", "guidanceOnly", "active", "sortOrder", "createdAt", "updatedAt"
) VALUES
  (
    '9e6f8e54-739e-4c0f-9157-4f4f211c9a01', 'CH', 'de-CH', 'commercial_register_extract',
    'Ticaret sicili özeti veya işletme kayıt belgesi',
    'Taslak yönlendirme metnidir; gereksinimler yayına alınmadan önce incelenmelidir.',
    FALSE, '["pdf","jpg","jpeg","png"]', TRUE, TRUE, 10, NOW(), NOW()
  ),
  (
    '9e6f8e54-739e-4c0f-9157-4f4f211c9a02', 'CH', 'de-CH', 'identity_document',
    'Yetkili temsilci kimlik belgesi',
    'Taslak yönlendirme metnidir; gereksinimler yayına alınmadan önce incelenmelidir.',
    FALSE, '["pdf","jpg","jpeg","png"]', TRUE, TRUE, 20, NOW(), NOW()
  ),
  (
    '9e6f8e54-739e-4c0f-9157-4f4f211c9a03', 'CH', 'de-CH', 'bank_statement',
    'Banka hesabı kanıt belgesi',
    'Taslak yönlendirme metnidir; gereksinimler yayına alınmadan önce incelenmelidir.',
    FALSE, '["pdf","jpg","jpeg","png"]', TRUE, TRUE, 30, NOW(), NOW()
  )
ON CONFLICT DO NOTHING;

INSERT INTO "ComplianceConsentDefinition" (
  "id", "country", "language", "consentKey", "label", "description",
  "documentCode", "documentVersion", "documentUrl", "required", "active", "sortOrder", "createdAt", "updatedAt"
) VALUES
  (
    'b79673e6-52dd-4597-94a4-747a0f120101', 'CH', 'de-CH', 'privacy_acknowledgement',
    'Bu iş ortağı başvurusuna ilişkin gizlilik bilgilendirmesini okuduğumu onaylıyorum.',
    'Taslak onay metnidir; hukuki inceleme tamamlanmadan nihai metin olarak kullanılmaz.',
    'partner_privacy_placeholder', 'placeholder-v1', NULL, TRUE, TRUE, 10, NOW(), NOW()
  ),
  (
    'b79673e6-52dd-4597-94a4-747a0f120102', 'CH', 'de-CH', 'partner_terms_acknowledgement',
    'Başvuru sırasında sunulan iş ortağı koşulları taslağını okuduğumu onaylıyorum.',
    'Taslak onay metnidir; hukuki inceleme tamamlanmadan nihai metin olarak kullanılmaz.',
    'partner_terms_placeholder', 'placeholder-v1', NULL, TRUE, TRUE, 20, NOW(), NOW()
  )
ON CONFLICT DO NOTHING;
