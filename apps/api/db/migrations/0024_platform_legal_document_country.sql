-- 0024 — Country-scope canonical customer/tenant legal documents.
--
-- MR-CUSTOMER-LEGAL-COUNTRY-SCOPING-01.
--
-- Adds a countryCode to PlatformLegalDocument so the canonical checkout-legal
-- pipeline can resolve documents per country (countryCode + locale + typeCode +
-- audience => current version), instead of being implicitly single-locale.
--
-- FORWARD-ONLY + ADDITIVE. No DROP, no destructive backfill, no constraint swap:
--   * `code` stays globally UNIQUE — country separation is expressed by
--     countryCode + the shared typeCode, NOT by overloading `code`. So no risk
--     of breaking the existing UNIQUE("code") contract.
--   * The new column is nullable; existing rows are backfilled from the active
--     InstallationProfile (single-country platform invariant: every store's
--     country equals the install country, so the install country is the
--     authoritative scope for any already-created legal document).
--   * Rows left NULL (no InstallationProfile yet) are intentionally treated as
--     "unscoped" by the readiness gate (legalReady=false) — we never invent a
--     CH/TR default here.

ALTER TABLE "PlatformLegalDocument"
  ADD COLUMN IF NOT EXISTS "countryCode" CHAR(2);

-- One-shot backfill for already-created documents. Fires only when an
-- InstallationProfile row exists; no-op on a fresh install (where canonical
-- legal docs are created by the admin AFTER setup writes the profile).
UPDATE "PlatformLegalDocument" d
SET "countryCode" = ip."countryCode"
FROM "InstallationProfile" ip
WHERE d."countryCode" IS NULL;

-- Country-aware lookup index for the checkout-readiness gate and the
-- (upcoming) admin "Müşteri Yasal Metinleri" country/audience filter.
CREATE INDEX IF NOT EXISTS "IDX_PlatformLegalDocument_country_audience_active"
  ON "PlatformLegalDocument" ("countryCode", "audience", "isActive");
