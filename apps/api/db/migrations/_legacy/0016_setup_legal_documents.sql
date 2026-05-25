-- Migration 0016: Minimal platform legal documents.
-- A deliberately lightweight table seeded during platform initialization.
-- No publish workflow, no approval pipeline, no localization system — just
-- the baseline legal documents the MVP needs to operate.

CREATE TABLE IF NOT EXISTS "LegalDocument" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Also keeps initialization idempotent: a re-seed cannot duplicate a doc.
  CONSTRAINT "UQ_LegalDocument_type_country_version"
    UNIQUE ("type", "countryCode", "version")
);
